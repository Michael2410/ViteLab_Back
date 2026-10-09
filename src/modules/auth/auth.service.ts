import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { eq, and, or, asc, desc, sql, isNull } from 'drizzle-orm';
import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import {
  db,
  usuarios,
  roles,
  personal,
  rolesPermisos,
  permisos,
  usuariosSedes,
  sedes,
  runInTenant,
  getTenantContext,
} from '../../db';
import {
  masterDb,
  masterIdentities,
  masterTenants,
  masterMemberships,
  masterSessions,
  masterMfaBackupCodes,
  masterAuthEvents,
} from '../../db/master';
import {
  encryptMfaSecret,
  decryptMfaSecret,
  hashBackupCode,
  verifyBackupCode,
} from '../../utils/crypto.utils';
import {
  Usuario,
  UsuarioConRol,
  LoginCredentials,
  LoginResponse,
  JwtPayload,
  TwoFactorJwtPayload,
  CreateUserRequest,
  UpdateUserRequest,
  UsuarioConPermisos,
  TenantSummary,
} from './auth.types';

function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }
  return codes;
}

export class AuthService {
  // ============================================
  // AUTENTICACIÓN
  // ============================================

  /**
   * Login de usuario (Paso 1: Validación de credenciales y bifurcación a 2FA)
   * Soporta autenticación Master DB (default) con fallback a legacy según AUTH_SOURCE
   */
  async login(
    credentials: LoginCredentials,
    ip?: string,
    userAgent?: string
  ): Promise<LoginResponse> {
    const authSource = process.env.AUTH_SOURCE || 'master';

    if (authSource === 'master') {
      return this.loginMaster(credentials, ip, userAgent);
    } else {
      return this.loginLegacy(credentials);
    }
  }

  /**
   * Login contra Master DB (Multi-Tenant)
   */
  async loginMaster(
    credentials: LoginCredentials,
    ip?: string,
    userAgent?: string
  ): Promise<LoginResponse> {
    const { username, password } = credentials;
    const input = username.trim().toLowerCase();

    // 1. Buscar identidad en Master por email
    let identity: any = null;

    if (input.includes('@')) {
      const [idRow] = await masterDb
        .select()
        .from(masterIdentities)
        .where(eq(masterIdentities.email, input));
      identity = idRow;
    } else {
      // Si el usuario ingresó su username (ej: "admin"), resolver email desde BD tenant
      const u = await runInTenant('vitelab_central', { kind: 'system', job: 'auth:resolve_user' }, async () => {
        const [found] = await db
          .select({ email: usuarios.email, identity_id: usuarios.identity_id })
          .from(usuarios)
          .where(and(sql`lower(${usuarios.username}) = ${input}`, eq(usuarios.activo, true)));
        return found;
      });

      if (u) {
        if (u.identity_id) {
          const [idRow] = await masterDb
            .select()
            .from(masterIdentities)
            .where(eq(masterIdentities.id, u.identity_id));
          identity = idRow;
        } else {
          const [idRow] = await masterDb
            .select()
            .from(masterIdentities)
            .where(eq(masterIdentities.email, u.email.trim().toLowerCase()));
          identity = idRow;
        }
      }
    }

    // Prevención de ataques de temporización (timing attack) si la identidad no existe
    if (!identity || identity.status !== 'ACTIVE') {
      await bcrypt.compare(password, '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUU123456789012');
      await this.recordAuthEvent('LOGIN_FAIL', null, null, ip, userAgent, {
        identifier: input,
        reason: 'identity_not_found_or_inactive',
      });
      throw new Error('Usuario o contraseña incorrectos');
    }

    // 2. Verificar contraseña contra password_hash en Master
    const isPasswordValid = await bcrypt.compare(password, identity.password_hash);
    if (!isPasswordValid) {
      await this.recordAuthEvent('LOGIN_FAIL', identity.id, null, ip, userAgent, {
        reason: 'invalid_password',
      });
      throw new Error('Usuario o contraseña incorrectos');
    }

    // 3. Obtener todas las membresías ACTIVAS del usuario en laboratorios ACTIVOS
    const activeTenants = await masterDb
      .select({
        id: masterTenants.id,
        slug: masterTenants.slug,
        name: masterTenants.name,
      })
      .from(masterMemberships)
      .innerJoin(masterTenants, eq(masterMemberships.tenant_id, masterTenants.id))
      .where(
        and(
          eq(masterMemberships.identity_id, identity.id),
          eq(masterMemberships.status, 'ACTIVE'),
          eq(masterTenants.status, 'ACTIVE')
        )
      );

    if (activeTenants.length === 0) {
      throw new Error('No tiene laboratorios clínicos activos asignados a su cuenta');
    }

    // 4. Si tiene MFA habilitado en Master, exigir primero 2FA
    if (identity.mfa_enabled && identity.mfa_secret_enc) {
      const tempToken = jwt.sign(
        {
          identityId: identity.id,
          email: identity.email,
          stage: '2fa_pending',
          tenantId: activeTenants.length === 1 ? activeTenants[0].id : undefined,
        } as TwoFactorJwtPayload,
        process.env.JWT_ACCESS_SECRET || 'access_secret',
        { expiresIn: '5m' }
      );

      return {
        requires2FA: true,
        setupNeeded: false,
        tempToken,
      };
    }

    // 4.1 Si debe cambiar contraseña obligatoriamente (primer login o reseteo por admin)
    if (identity.must_change_password) {
      const tempToken = jwt.sign(
        {
          identityId: identity.id,
          email: identity.email,
          stage: 'password_change_pending',
          tenantId: activeTenants.length === 1 ? activeTenants[0].id : undefined,
        } as TwoFactorJwtPayload,
        process.env.JWT_ACCESS_SECRET || 'access_secret',
        { expiresIn: '15m' }
      );

      return {
        requiresPasswordChange: true,
        requires2FA: false,
        requiresTenantSelection: false,
        tempToken,
        email: identity.email,
      };
    }

    // 5. Si pertenece a UN SOLO laboratorio, ingresar directamente
    if (activeTenants.length === 1) {
      return this.completeTenantLogin(identity, activeTenants[0].id);
    }

    // 6. Si pertenece a MÚLTIPLES laboratorios activos, emitir token de selección
    const tempToken = jwt.sign(
      {
        identityId: identity.id,
        email: identity.email,
        stage: 'tenant_selection',
      } as TwoFactorJwtPayload,
      process.env.JWT_ACCESS_SECRET || 'access_secret',
      { expiresIn: '5m' }
    );

    return {
      requiresTenantSelection: true,
      requires2FA: false,
      tempToken,
      tenants: activeTenants,
    };
  }

  /**
   * Completa el login dentro del tenant especificado
   */
  async completeTenantLogin(
    identity: any,
    tenantId: string,
    backupCodes?: string[]
  ): Promise<LoginResponse> {
    return await runInTenant(tenantId, { kind: 'system', job: 'auth:login' }, async () => {
      const [user] = await db
        .select({
          id: usuarios.id,
          identity_id: usuarios.identity_id,
          username: usuarios.username,
          email: usuarios.email,
          password_hash: usuarios.password_hash,
          rol_id: usuarios.rol_id,
          personal_id: usuarios.personal_id,
          activo: usuarios.activo,
          two_factor_enabled: usuarios.two_factor_enabled,
          two_factor_secret: usuarios.two_factor_secret,
          refresh_token: usuarios.refresh_token,
          refresh_token_expires_at: usuarios.refresh_token_expires_at,
          created_at: usuarios.created_at,
          updated_at: usuarios.updated_at,
          nombres: sql<string>`COALESCE(${personal.nombres}, ${usuarios.username})`,
          apellidos: sql<string>`COALESCE(${personal.apellidos}, '')`,
          firma_url: personal.firma_url,
          rol_nombre: roles.nombre,
          rol_descripcion: roles.descripcion,
        })
        .from(usuarios)
        .innerJoin(roles, eq(usuarios.rol_id, roles.id))
        .leftJoin(personal, eq(usuarios.personal_id, personal.id))
        .where(and(eq(usuarios.identity_id, identity.id), eq(usuarios.activo, true)));

      if (!user) {
        throw new Error('Usuario no encontrado o inactivo en este laboratorio');
      }

      // Si la identidad no tiene enrolado 2FA en Master, ofrecer onboarding inicial
      if (!identity.mfa_enabled) {
        const secret = generateSecret();
        const otpauth = generateURI({ issuer: 'ViteLab', label: identity.email, secret });
        const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

        await db
          .update(usuarios)
          .set({ two_factor_temp_secret: secret })
          .where(eq(usuarios.id, user.id));

        const tempToken = jwt.sign(
          {
            userId: user.id,
            identityId: identity.id,
            tenantId: tenantId,
            username: user.username,
            email: identity.email,
            stage: '2fa_setup_pending',
          } as TwoFactorJwtPayload,
          process.env.JWT_ACCESS_SECRET || 'access_secret',
          { expiresIn: '10m' }
        );

        return {
          requires2FA: true,
          setupNeeded: true,
          tempToken,
          qrCodeDataUrl,
          manualKey: secret,
        };
      }

      return this.completeLoginSession(user, backupCodes, identity.id, tenantId);
    });
  }

  /**
   * Seleccionar laboratorio en login multi-tenant
   */
  async selectTenant(tempToken: string, tenantId: string): Promise<LoginResponse> {
    let payload: TwoFactorJwtPayload;
    try {
      payload = jwt.verify(
        tempToken,
        process.env.JWT_ACCESS_SECRET || 'access_secret'
      ) as TwoFactorJwtPayload;
    } catch {
      throw new Error('La sesión de selección de laboratorio ha expirado. Inicie sesión nuevamente.');
    }

    if (payload.stage !== 'tenant_selection' || !payload.identityId) {
      throw new Error('Token de selección de laboratorio inválido');
    }

    const [membership] = await masterDb
      .select()
      .from(masterMemberships)
      .innerJoin(masterTenants, eq(masterMemberships.tenant_id, masterTenants.id))
      .where(
        and(
          eq(masterMemberships.identity_id, payload.identityId),
          eq(masterMemberships.tenant_id, tenantId),
          eq(masterMemberships.status, 'ACTIVE'),
          eq(masterTenants.status, 'ACTIVE')
        )
      );

    if (!membership) {
      throw new Error('No tiene membresía activa en el laboratorio clínico seleccionado');
    }

    const [identity] = await masterDb
      .select()
      .from(masterIdentities)
      .where(eq(masterIdentities.id, payload.identityId));

    if (!identity || identity.status !== 'ACTIVE') {
      throw new Error('Cuenta de usuario no disponible');
    }

    await this.recordAuthEvent('TENANT_SELECT', payload.identityId, tenantId);

    return this.completeTenantLogin(identity, tenantId);
  }

  /**
   * Cambiar de laboratorio para una sesión activa
   */
  async switchTenant(
    identityId: string,
    currentSessionId: string | undefined,
    targetTenantId: string
  ): Promise<LoginResponse> {
    // 1. Validar membership en el nuevo laboratorio
    const [membership] = await masterDb
      .select()
      .from(masterMemberships)
      .innerJoin(masterTenants, eq(masterMemberships.tenant_id, masterTenants.id))
      .where(
        and(
          eq(masterMemberships.identity_id, identityId),
          eq(masterMemberships.tenant_id, targetTenantId),
          eq(masterMemberships.status, 'ACTIVE'),
          eq(masterTenants.status, 'ACTIVE')
        )
      );

    if (!membership) {
      await this.recordAuthEvent('TENANT_SWITCH_FAIL', identityId, targetTenantId, null, null, {
        reason: 'no_membership',
      });
      throw new Error('No tiene membresía activa en el laboratorio solicitado');
    }

    // 2. Revocar sesión anterior si existe
    if (currentSessionId) {
      await masterDb
        .update(masterSessions)
        .set({
          revoked_at: new Date(),
          revoked_reason: 'switch_tenant',
        })
        .where(eq(masterSessions.id, currentSessionId));
    }

    const [identity] = await masterDb
      .select()
      .from(masterIdentities)
      .where(eq(masterIdentities.id, identityId));

    if (!identity) {
      throw new Error('Identidad no encontrada');
    }

    await this.recordAuthEvent('TENANT_SWITCH_SUCCESS', identityId, targetTenantId, null, null, {
      previousSessionId: currentSessionId,
    });

    return this.completeTenantLogin(identity, targetTenantId);
  }

  /**
   * Obtiene la lista de laboratorios activos donde el usuario tiene membresía
   */
  async getUserActiveTenants(
    identityId: string,
    currentTenantId?: string
  ): Promise<(TenantSummary & { isCurrent: boolean })[]> {
    const list = await masterDb
      .select({
        id: masterTenants.id,
        slug: masterTenants.slug,
        name: masterTenants.name,
      })
      .from(masterMemberships)
      .innerJoin(masterTenants, eq(masterMemberships.tenant_id, masterTenants.id))
      .where(
        and(
          eq(masterMemberships.identity_id, identityId),
          eq(masterMemberships.status, 'ACTIVE'),
          eq(masterTenants.status, 'ACTIVE')
        )
      );

    return list.map((t) => ({
      ...t,
      isCurrent: t.id === currentTenantId,
    }));
  }

  /**
   * Login Legacy (Contra BD tenant única, preservado para rollback sin pérdida)
   */
  private async loginLegacy(credentials: LoginCredentials): Promise<LoginResponse> {
    const { username, password } = credentials;

    const [user] = await db
      .select({
        id: usuarios.id,
        username: usuarios.username,
        email: usuarios.email,
        password_hash: usuarios.password_hash,
        rol_id: usuarios.rol_id,
        personal_id: usuarios.personal_id,
        activo: usuarios.activo,
        two_factor_enabled: usuarios.two_factor_enabled,
        two_factor_secret: usuarios.two_factor_secret,
        refresh_token: usuarios.refresh_token,
        refresh_token_expires_at: usuarios.refresh_token_expires_at,
        created_at: usuarios.created_at,
        updated_at: usuarios.updated_at,
        nombres: sql<string>`COALESCE(${personal.nombres}, ${usuarios.username})`,
        apellidos: sql<string>`COALESCE(${personal.apellidos}, '')`,
        firma_url: personal.firma_url,
        rol_nombre: roles.nombre,
        rol_descripcion: roles.descripcion,
      })
      .from(usuarios)
      .innerJoin(roles, eq(usuarios.rol_id, roles.id))
      .leftJoin(personal, eq(usuarios.personal_id, personal.id))
      .where(
        and(
          or(eq(usuarios.username, username), eq(usuarios.email, username.toLowerCase())),
          eq(usuarios.activo, true)
        )
      );

    if (!user) {
      throw new Error('Usuario o contraseña incorrectos');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Usuario o contraseña incorrectos');
    }

    if (user.two_factor_enabled && user.two_factor_secret) {
      const tempToken = jwt.sign(
        {
          userId: user.id,
          username: user.username,
          email: user.email,
          stage: '2fa_pending',
        } as TwoFactorJwtPayload,
        process.env.JWT_ACCESS_SECRET || 'access_secret',
        { expiresIn: '5m' }
      );

      return {
        requires2FA: true,
        setupNeeded: false,
        tempToken,
      };
    }

    const secret = generateSecret();
    const otpauth = generateURI({ issuer: 'ViteLab', label: user.username, secret });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

    await db
      .update(usuarios)
      .set({ two_factor_temp_secret: secret })
      .where(eq(usuarios.id, user.id));

    const tempToken = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        email: user.email,
        stage: '2fa_setup_pending',
      } as TwoFactorJwtPayload,
      process.env.JWT_ACCESS_SECRET || 'access_secret',
      { expiresIn: '10m' }
    );

    return {
      requires2FA: true,
      setupNeeded: true,
      tempToken,
      qrCodeDataUrl,
      manualKey: secret,
    };
  }

  /**
   * Confirmar vinculación inicial de 2FA TOTP
   */
  async confirm2FASetup(tempToken: string, code: string): Promise<LoginResponse> {
    let payload: TwoFactorJwtPayload;
    try {
      payload = jwt.verify(
        tempToken,
        process.env.JWT_ACCESS_SECRET || 'access_secret'
      ) as TwoFactorJwtPayload;
    } catch {
      throw new Error('La sesión de configuración ha expirado. Inicia sesión nuevamente.');
    }

    if (!payload.userId) {
      throw new Error('Token de configuración no válido (falta ID de usuario).');
    }

    const currentUserId = payload.userId;

    return await runInTenant(payload.tenantId || 'vitelab_central', { kind: 'user', identityId: payload.identityId || String(currentUserId), usuarioId: currentUserId }, async () => {
      const [user] = await db
        .select({
          id: usuarios.id,
          identity_id: usuarios.identity_id,
          username: usuarios.username,
          email: usuarios.email,
          rol_id: usuarios.rol_id,
          personal_id: usuarios.personal_id,
          activo: usuarios.activo,
          two_factor_temp_secret: usuarios.two_factor_temp_secret,
          created_at: usuarios.created_at,
          updated_at: usuarios.updated_at,
          nombres: sql<string>`COALESCE(${personal.nombres}, ${usuarios.username})`,
          apellidos: sql<string>`COALESCE(${personal.apellidos}, '')`,
          firma_url: personal.firma_url,
          rol_nombre: roles.nombre,
          rol_descripcion: roles.descripcion,
        })
        .from(usuarios)
        .innerJoin(roles, eq(usuarios.rol_id, roles.id))
        .leftJoin(personal, eq(usuarios.personal_id, personal.id))
        .where(and(eq(usuarios.id, currentUserId), eq(usuarios.activo, true)));

      if (!user || !user.two_factor_temp_secret) {
        throw new Error('Configuración no encontrada o usuario inactivo.');
      }

      // Validar código TOTP contra el secreto temporal
      const isValid = verifySync({ token: code.trim(), secret: user.two_factor_temp_secret, epochTolerance: 30 }).valid;
      if (!isValid) {
        throw new Error('Código de verificación incorrecto. Ingresa el código actual que muestra tu aplicación.');
      }

      // Generar códigos de respaldo únicos
      const backupCodes = generateBackupCodes(8);

      // 1. Si AUTH_SOURCE es master y el usuario tiene identity_id, guardar en Master DB
      const authSource = process.env.AUTH_SOURCE || 'master';
      if (authSource === 'master' && user.identity_id) {
        const encryptedSecret = encryptMfaSecret(user.two_factor_temp_secret);
        await masterDb
          .update(masterIdentities)
          .set({
            mfa_enabled: true,
            mfa_secret_enc: encryptedSecret,
            mfa_enrolled_at: new Date(),
            updated_at: new Date(),
          })
          .where(eq(masterIdentities.id, user.identity_id));

        // Guardar códigos de respaldo hasheados en Master DB
        await masterDb.delete(masterMfaBackupCodes).where(eq(masterMfaBackupCodes.identity_id, user.identity_id));
        for (const bCode of backupCodes) {
          await masterDb.insert(masterMfaBackupCodes).values({
            identity_id: user.identity_id,
            code_hash: hashBackupCode(bCode),
          });
        }
      }

      // 2. Activar 2FA también en la BD local del tenant para redundancia
      await db
        .update(usuarios)
        .set({
          two_factor_enabled: true,
          two_factor_secret: user.two_factor_temp_secret,
          two_factor_temp_secret: null,
          two_factor_backup_codes: JSON.stringify(backupCodes),
        })
        .where(eq(usuarios.id, user.id));

      return this.completeLoginSession(user, backupCodes, payload.identityId, payload.tenantId);
    });
  }

  /**
   * Verificar código 2FA en login habitual
   */
  async verify2FA(tempToken: string, code: string): Promise<LoginResponse> {
    let payload: TwoFactorJwtPayload;
    try {
      payload = jwt.verify(
        tempToken,
        process.env.JWT_ACCESS_SECRET || 'access_secret'
      ) as TwoFactorJwtPayload;
    } catch {
      throw new Error('La sesión de verificación ha expirado. Inicia sesión nuevamente.');
    }

    if (payload.stage !== '2fa_pending') {
      throw new Error('Token de verificación no válido.');
    }

    const authSource = process.env.AUTH_SOURCE || 'master';

    // ============================================
    // CASO 1: VERIFICACIÓN CON MASTER DB
    // ============================================
    if (authSource === 'master' && payload.identityId) {
      const identityId = payload.identityId;
      const [identity] = await masterDb
        .select()
        .from(masterIdentities)
        .where(eq(masterIdentities.id, identityId));

      if (!identity || !identity.mfa_enabled || !identity.mfa_secret_enc) {
        throw new Error('Usuario no encontrado o 2FA no habilitado en Master.');
      }

      const decryptedSecret = decryptMfaSecret(identity.mfa_secret_enc);
      let isValid = verifySync({ token: code.trim(), secret: decryptedSecret, epochTolerance: 30 }).valid;

      // Probar códigos de respaldo en Master
      if (!isValid) {
        const inputHash = hashBackupCode(code);
        const [matchingCode] = await masterDb
          .select()
          .from(masterMfaBackupCodes)
          .where(
            and(
              eq(masterMfaBackupCodes.identity_id, identity.id),
              eq(masterMfaBackupCodes.code_hash, inputHash),
              isNull(masterMfaBackupCodes.used_at)
            )
          );

        if (matchingCode) {
          isValid = true;
          // Quemar código de respaldo usado
          await masterDb
            .update(masterMfaBackupCodes)
            .set({ used_at: new Date() })
            .where(eq(masterMfaBackupCodes.id, matchingCode.id));
        }
      }

      if (!isValid) {
        throw new Error('Código de autenticación incorrecto o expirado.');
      }

      // Si debe cambiar contraseña tras validar 2FA
      if (identity.must_change_password) {
        const tempToken = jwt.sign(
          {
            identityId: identity.id,
            email: identity.email,
            stage: 'password_change_pending',
            tenantId: payload.tenantId,
          } as TwoFactorJwtPayload,
          process.env.JWT_ACCESS_SECRET || 'access_secret',
          { expiresIn: '15m' }
        );

        return {
          requiresPasswordChange: true,
          requires2FA: false,
          requiresTenantSelection: false,
          tempToken,
          email: identity.email,
        };
      }

      // Si venía un tenantId preseleccionado en el token temporal
      if (payload.tenantId) {
        return this.completeTenantLogin(identity, payload.tenantId);
      }

      // Si no, evaluar membresías activas del usuario
      const userTenants = await this.getUserActiveTenants(identity.id);
      if (userTenants.length === 1) {
        return this.completeTenantLogin(identity, userTenants[0].id);
      } else if (userTenants.length > 1) {
        const tempToken = jwt.sign(
          {
            identityId: identity.id,
            email: identity.email,
            stage: 'tenant_selection',
          } as TwoFactorJwtPayload,
          process.env.JWT_ACCESS_SECRET || 'access_secret',
          { expiresIn: '5m' }
        );
        return {
          requiresTenantSelection: true,
          requires2FA: false,
          tempToken,
          tenants: userTenants,
        };
      } else {
        throw new Error('No tiene laboratorios clínicos activos asignados');
      }
    }

    // ============================================
    // CASO 2: VERIFICACIÓN LEGACY
    // ============================================
    if (!payload.userId) {
      throw new Error('ID de usuario no encontrado en token');
    }
    const legacyUserId = payload.userId;

    const [user] = await db
      .select({
        id: usuarios.id,
        identity_id: usuarios.identity_id,
        username: usuarios.username,
        email: usuarios.email,
        rol_id: usuarios.rol_id,
        personal_id: usuarios.personal_id,
        activo: usuarios.activo,
        two_factor_enabled: usuarios.two_factor_enabled,
        two_factor_secret: usuarios.two_factor_secret,
        two_factor_backup_codes: usuarios.two_factor_backup_codes,
        created_at: usuarios.created_at,
        updated_at: usuarios.updated_at,
        nombres: sql<string>`COALESCE(${personal.nombres}, ${usuarios.username})`,
        apellidos: sql<string>`COALESCE(${personal.apellidos}, '')`,
        firma_url: personal.firma_url,
        rol_nombre: roles.nombre,
        rol_descripcion: roles.descripcion,
      })
      .from(usuarios)
      .innerJoin(roles, eq(usuarios.rol_id, roles.id))
      .leftJoin(personal, eq(usuarios.personal_id, personal.id))
      .where(and(eq(usuarios.id, legacyUserId), eq(usuarios.activo, true)));

    if (!user || !user.two_factor_secret) {
      throw new Error('Usuario no encontrado o 2FA no habilitado.');
    }

    let isValid = verifySync({ token: code.trim(), secret: user.two_factor_secret, epochTolerance: 30 }).valid;

    if (!isValid && user.two_factor_backup_codes) {
      try {
        const backupCodes: string[] = JSON.parse(user.two_factor_backup_codes);
        const normalizedInput = code.trim().toUpperCase().replace(/[\s-]/g, '');
        const foundIndex = backupCodes.findIndex(
          (b) => b.replace(/-/g, '').toUpperCase() === normalizedInput
        );

        if (foundIndex !== -1) {
          isValid = true;
          backupCodes.splice(foundIndex, 1);
          await db
            .update(usuarios)
            .set({ two_factor_backup_codes: JSON.stringify(backupCodes) })
            .where(eq(usuarios.id, user.id));
        }
      } catch (e) {
        console.error('Error al verificar códigos de respaldo:', e);
      }
    }

    if (!isValid) {
      throw new Error('Código de autenticación incorrecto o expirado.');
    }

    return this.completeLoginSession(user);
  }

  /**
   * Resetear 2FA por parte de un Administrador (desde gestión de usuarios)
   */
  async adminReset2FA(targetUserId: number): Promise<void> {
    const [user] = await db
      .select({ id: usuarios.id, identity_id: usuarios.identity_id })
      .from(usuarios)
      .where(eq(usuarios.id, targetUserId));

    if (user?.identity_id) {
      // Limpiar 2FA en Master DB
      await masterDb
        .update(masterIdentities)
        .set({
          mfa_enabled: false,
          mfa_secret_enc: null,
          mfa_enrolled_at: null,
          updated_at: new Date(),
        })
        .where(eq(masterIdentities.id, user.identity_id));

      await masterDb
        .delete(masterMfaBackupCodes)
        .where(eq(masterMfaBackupCodes.identity_id, user.identity_id));
    }

    // Limpiar 2FA en BD del tenant
    await db
      .update(usuarios)
      .set({
        two_factor_enabled: false,
        two_factor_secret: null,
        two_factor_temp_secret: null,
        two_factor_backup_codes: null,
        updated_at: sql`CURRENT_TIMESTAMP` as any,
      })
      .where(eq(usuarios.id, targetUserId));
  }

  /**
   * Cambiar contraseña inicial o provisional tras primer login o reseteo
   */
  async changeInitialPassword(
    tempToken: string,
    newPassword: string
  ): Promise<LoginResponse> {
    let payload: TwoFactorJwtPayload;
    try {
      payload = jwt.verify(
        tempToken,
        process.env.JWT_ACCESS_SECRET || 'access_secret'
      ) as TwoFactorJwtPayload;
    } catch {
      throw new Error('La sesión para cambiar contraseña ha expirado. Inicia sesión nuevamente.');
    }

    if (payload.stage !== 'password_change_pending' || !payload.identityId) {
      throw new Error('Token no válido para cambio de contraseña obligatorio.');
    }

    if (!newPassword || newPassword.trim().length < 6) {
      throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
    }

    const [identity] = await masterDb
      .select()
      .from(masterIdentities)
      .where(eq(masterIdentities.id, payload.identityId));

    if (!identity || identity.status !== 'ACTIVE') {
      throw new Error('Cuenta de usuario no disponible o inactiva.');
    }

    // Verificar que la nueva clave no sea igual a la provisional
    if (identity.password_hash) {
      const isSamePassword = await bcrypt.compare(newPassword, identity.password_hash);
      if (isSamePassword) {
        throw new Error('La nueva contraseña debe ser diferente a la contraseña provisional.');
      }
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // 1. Actualizar Master DB
    await masterDb
      .update(masterIdentities)
      .set({
        password_hash: newPasswordHash,
        must_change_password: false,
        password_changed_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(masterIdentities.id, identity.id));

    // 2. Obtener laboratorios activos del usuario
    const userTenants = await this.getUserActiveTenants(identity.id);

    // 3. Sincronizar en tenants donde tenga cuenta
    for (const t of userTenants) {
      try {
        await runInTenant(t.id, { kind: 'system', job: 'auth:sync-password' }, async () => {
          await db
            .update(usuarios)
            .set({
              password_hash: newPasswordHash,
              updated_at: sql`CURRENT_TIMESTAMP` as any,
            })
            .where(eq(usuarios.identity_id, identity.id));
        });
      } catch (err) {
        console.warn(`No se pudo sincronizar clave en tenant ${t.id}:`, err);
      }
    }

    await this.recordAuthEvent('PASSWORD_CHANGE', identity.id, payload.tenantId || null, null, null, {
      type: 'initial_or_reset_change',
    });

    // 4. Continuar al laboratorio correspondiente
    if (payload.tenantId) {
      return this.completeTenantLogin(identity, payload.tenantId);
    }

    if (userTenants.length === 1) {
      return this.completeTenantLogin(identity, userTenants[0].id);
    } else if (userTenants.length > 1) {
      const tenantToken = jwt.sign(
        {
          identityId: identity.id,
          email: identity.email,
          stage: 'tenant_selection',
        } as TwoFactorJwtPayload,
        process.env.JWT_ACCESS_SECRET || 'access_secret',
        { expiresIn: '5m' }
      );
      return {
        requiresTenantSelection: true,
        requires2FA: false,
        tempToken: tenantToken,
        tenants: userTenants,
      };
    } else {
      throw new Error('No tiene laboratorios clínicos activos asignados');
    }
  }

  /**
   * Resetear contraseña de un usuario por parte del Administrador
   */
  async adminResetPassword(
    targetUserId: number,
    customNewPassword?: string
  ): Promise<{ temporaryPassword: string; message: string }> {
    const [user] = await db
      .select({
        id: usuarios.id,
        identity_id: usuarios.identity_id,
        username: usuarios.username,
        email: usuarios.email,
      })
      .from(usuarios)
      .where(eq(usuarios.id, targetUserId));

    if (!user) {
      throw new Error('Usuario no encontrado en este laboratorio');
    }

    // Generar contraseña temporal si no se provee una
    const tempPassword =
      customNewPassword && customNewPassword.trim().length >= 6
        ? customNewPassword.trim()
        : `ViteLab${Math.floor(1000 + Math.random() * 9000)}!`;

    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // 1. Actualizar en el tenant DB
    await db
      .update(usuarios)
      .set({
        password_hash: passwordHash,
        updated_at: sql`CURRENT_TIMESTAMP` as any,
      })
      .where(eq(usuarios.id, targetUserId));

    // 2. Si tiene identidad en Master DB, forzar must_change_password = true
    if (user.identity_id) {
      await masterDb
        .update(masterIdentities)
        .set({
          password_hash: passwordHash,
          must_change_password: true,
          password_changed_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(masterIdentities.id, user.identity_id));

      await this.recordAuthEvent('ADMIN_PASSWORD_RESET', user.identity_id, null, null, null, {
        targetUserId: user.id,
        username: user.username,
      });
    }

    return {
      temporaryPassword: tempPassword,
      message:
        'Contraseña restablecida exitosamente. El usuario deberá cambiarla obligatoriamente en su próximo inicio de sesión.',
    };
  }

  /**
   * Completar sesión de login y emitir tokens JWT
   */
  private async completeLoginSession(
    user: any,
    backupCodes?: string[],
    identityId?: string,
    tenantId?: string
  ): Promise<LoginResponse> {
    const userSedes = await this.getUserSedes(user.id);
    const userPermisos = await this.getUserPermisos(user.rol_id);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    let sessionId: string | undefined;

    // Registrar sesión en Master DB si aplica
    const authSource = process.env.AUTH_SOURCE || 'master';
    const effectiveIdentityId = identityId || user.identity_id;

    if (authSource === 'master' && effectiveIdentityId) {
      try {
        const refreshPlaceholder = crypto.randomBytes(32).toString('hex');
        const refreshHash = crypto.createHash('sha256').update(refreshPlaceholder).digest('hex');

        const [sessionRow] = await masterDb
          .insert(masterSessions)
          .values({
            identity_id: effectiveIdentityId,
            tenant_id: tenantId || null,
            refresh_token_hash: refreshHash,
            mfa_verified_at: new Date(),
            expires_at: expiresAt,
          })
          .returning({ id: masterSessions.id });

        sessionId = sessionRow?.id;
      } catch (err) {
        console.warn('⚠️ No se pudo registrar sesión en masterSessions:', err);
      }
    }

    const accessToken = this.generateAccessToken({
      userId: user.id,
      username: user.username,
      email: user.email,
      rolId: user.rol_id,
      sub: effectiveIdentityId,
      tenantId: tenantId,
      sessionId: sessionId,
      scope: 'tenant',
    });

    const refreshToken = this.generateRefreshToken({
      userId: user.id,
      username: user.username,
      email: user.email,
      rolId: user.rol_id,
      sub: effectiveIdentityId,
      tenantId: tenantId,
      sessionId: sessionId,
      scope: 'tenant',
    });

    // Actualizar hash real de refresh token en Master si hubo sesión
    if (sessionId) {
      const realRefreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await masterDb
        .update(masterSessions)
        .set({ refresh_token_hash: realRefreshHash })
        .where(eq(masterSessions.id, sessionId));
    }

    // Guardar en BD tenant para retrocompatibilidad
    await db
      .update(usuarios)
      .set({
        refresh_token: refreshToken,
        refresh_token_expires_at: expiresAt.toISOString() as any,
      })
      .where(eq(usuarios.id, user.id));

    const {
      password_hash: _,
      refresh_token: __,
      refresh_token_expires_at: ___,
      two_factor_secret: ____,
      two_factor_temp_secret: _____,
      two_factor_backup_codes: ______,
      ...userWithoutSensitiveData
    } = user;

    let activeTenant: any = undefined;
    if (tenantId) {
      const [t] = await masterDb
        .select({
          id: masterTenants.id,
          slug: masterTenants.slug,
          name: masterTenants.name,
        })
        .from(masterTenants)
        .where(eq(masterTenants.id, tenantId));
      if (t) activeTenant = t;
    }

    await this.recordAuthEvent('LOGIN_SUCCESS', effectiveIdentityId, tenantId, null, null, {
      username: user.username,
      sessionId,
    });

    return {
      requires2FA: false,
      requiresTenantSelection: false,
      user: {
        ...userWithoutSensitiveData,
        two_factor_enabled: true,
        sedes: userSedes,
        permisos: userPermisos,
      } as any,
      activeTenant,
      accessToken,
      refreshToken,
      ...(backupCodes ? { backupCodes } : {}),
    };
  }

  /**
   * Refresh token
   */
  async refreshToken(
    oldRefreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const decoded = jwt.verify(
        oldRefreshToken,
        process.env.JWT_REFRESH_SECRET || 'refresh_secret'
      ) as JwtPayload;

      return await runInTenant(decoded.tenantId || 'vitelab_central', { kind: 'user', identityId: decoded.sub || String(decoded.userId), usuarioId: decoded.userId }, async () => {
        const [user] = await db
          .select({
            id: usuarios.id,
            username: usuarios.username,
            email: usuarios.email,
            rol_id: usuarios.rol_id,
            refresh_token: usuarios.refresh_token,
            refresh_token_expires_at: usuarios.refresh_token_expires_at,
          })
          .from(usuarios)
          .where(and(eq(usuarios.id, decoded.userId), eq(usuarios.activo, true)));

        if (!user) {
          throw new Error('Usuario no encontrado');
        }

        if (user.refresh_token !== oldRefreshToken) {
          throw new Error('Token inválido');
        }

        if (!user.refresh_token_expires_at || new Date() > new Date(user.refresh_token_expires_at)) {
          throw new Error('Refresh token expirado');
        }

        const accessToken = this.generateAccessToken({
          userId: user.id,
          username: user.username,
          email: user.email,
          rolId: user.rol_id,
          sub: decoded.sub,
          tenantId: decoded.tenantId,
          sessionId: decoded.sessionId,
          scope: 'tenant',
        });

        const refreshToken = this.generateRefreshToken({
          userId: user.id,
          username: user.username,
          email: user.email,
          rolId: user.rol_id,
          sub: decoded.sub,
          tenantId: decoded.tenantId,
          sessionId: decoded.sessionId,
          scope: 'tenant',
        });

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await db
          .update(usuarios)
          .set({
            refresh_token: refreshToken,
            refresh_token_expires_at: expiresAt.toISOString() as any,
          })
          .where(eq(usuarios.id, user.id));

        return {
          accessToken,
          refreshToken,
        };
      });
    } catch (error) {
      throw new Error('Token inválido o expirado');
    }
  }

  /**
   * Logout
   */
  async logout(userId: number): Promise<void> {
    await db
      .update(usuarios)
      .set({
        refresh_token: null,
        refresh_token_expires_at: null,
      })
      .where(eq(usuarios.id, userId));
  }

  /**
   * Obtener usuario con permisos
   */
  async getUserWithPermissions(userId: number): Promise<UsuarioConPermisos> {
    const [user] = await db
      .select({
        id: usuarios.id,
        username: usuarios.username,
        email: usuarios.email,
        rol_id: usuarios.rol_id,
        personal_id: usuarios.personal_id,
        activo: usuarios.activo,
        created_at: usuarios.created_at,
        updated_at: usuarios.updated_at,
        nombres: sql<string>`COALESCE(${personal.nombres}, ${usuarios.username})`,
        apellidos: sql<string>`COALESCE(${personal.apellidos}, '')`,
        firma_url: personal.firma_url,
        rol_nombre: roles.nombre,
        rol_descripcion: roles.descripcion,
      })
      .from(usuarios)
      .innerJoin(roles, eq(usuarios.rol_id, roles.id))
      .leftJoin(personal, eq(usuarios.personal_id, personal.id))
      .where(and(eq(usuarios.id, userId), eq(usuarios.activo, true)));

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    const permisosList = await this.getUserPermisos(user.rol_id);

    return {
      ...(user as any),
      permisos: permisosList,
    };
  }

  // ============================================
  // GESTIÓN DE USUARIOS
  // ============================================

  /**
   * Obtener sedes de un usuario
   */
  async getUserSedes(userId: number): Promise<{ id: number; nombre: string }[]> {
    return db
      .select({
        id: sedes.id,
        nombre: sedes.nombre,
      })
      .from(usuariosSedes)
      .innerJoin(sedes, eq(usuariosSedes.sede_id, sedes.id))
      .where(and(eq(usuariosSedes.usuario_id, userId), eq(sedes.activo, true)))
      .orderBy(asc(sedes.nombre));
  }

  /**
   * Obtener permisos de un rol
   */
  async getUserPermisos(rolId: number): Promise<string[]> {
    const rows = await db
      .select({ codigo: permisos.codigo })
      .from(rolesPermisos)
      .innerJoin(permisos, eq(rolesPermisos.permiso_id, permisos.id))
      .where(eq(rolesPermisos.rol_id, rolId));

    return rows.map((row) => row.codigo);
  }

  /**
   * Asignar sedes a un usuario
   */
  async assignUserSedes(userId: number, sedeIds: number[]): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(usuariosSedes).where(eq(usuariosSedes.usuario_id, userId));

      if (sedeIds.length > 0) {
        await tx.insert(usuariosSedes).values(
          sedeIds.map((sede_id) => ({
            usuario_id: userId,
            sede_id,
          }))
        );
      }
    });
  }

  /**
   * Crear usuario
   */
  async createUser(userData: CreateUserRequest): Promise<Usuario> {
    const { username, email, password, rol_id, personal_id, sede_ids } = userData;

    // Verificar si username o email ya existe
    const existing = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(or(eq(usuarios.username, username), eq(usuarios.email, email)));

    if (existing.length > 0) {
      throw new Error('El usuario o email ya existe');
    }

    const password_hash = await bcrypt.hash(password, 10);

    // Sincronizar o crear identidad en Master DB
    let identityId: string | null = null;
    const authSource = process.env.AUTH_SOURCE || 'master';

    if (authSource === 'master') {
      const cleanEmail = email.trim().toLowerCase();
      const [existingIdentity] = await masterDb
        .select()
        .from(masterIdentities)
        .where(eq(masterIdentities.email, cleanEmail));

      if (existingIdentity) {
        identityId = existingIdentity.id;
      } else {
        const [newIdentity] = await masterDb
          .insert(masterIdentities)
          .values({
            email: cleanEmail,
            password_hash,
            status: 'ACTIVE',
            email_verified_at: new Date(),
            must_change_password: true,
          })
          .returning({ id: masterIdentities.id });
        identityId = newIdentity.id;
      }

      // Crear membresía en Master para este tenant
      let currentTenantId: string | null = null;
      try {
        const ctx = getTenantContext();
        currentTenantId = ctx?.tenantId || null;
      } catch {
        currentTenantId = null;
      }

      if (currentTenantId && identityId) {
        await masterDb
          .insert(masterMemberships)
          .values({
            identity_id: identityId,
            tenant_id: currentTenantId,
            status: 'ACTIVE',
          })
          .onConflictDoUpdate({
            target: [masterMemberships.identity_id, masterMemberships.tenant_id],
            set: { status: 'ACTIVE', updated_at: new Date() },
          });
      }
    }

    return await db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(usuarios)
        .values({
          username,
          email,
          password_hash,
          rol_id,
          personal_id: personal_id || null,
          identity_id: identityId,
        })
        .returning({
          id: usuarios.id,
          username: usuarios.username,
          email: usuarios.email,
          rol_id: usuarios.rol_id,
          personal_id: usuarios.personal_id,
          activo: usuarios.activo,
          created_at: usuarios.created_at,
          updated_at: usuarios.updated_at,
        });

      if (sede_ids && sede_ids.length > 0) {
        await tx.insert(usuariosSedes).values(
          sede_ids.map((sede_id) => ({
            usuario_id: newUser.id,
            sede_id,
          }))
        );
      }

      return newUser as any;
    });
  }

  /**
   * Obtener todos los usuarios
   */
  async getAllUsers(): Promise<UsuarioConRol[]> {
    const userRows = await db
      .select({
        id: usuarios.id,
        username: usuarios.username,
        email: usuarios.email,
        rol_id: usuarios.rol_id,
        personal_id: usuarios.personal_id,
        activo: usuarios.activo,
        two_factor_enabled: sql<boolean>`COALESCE(${usuarios.two_factor_enabled}, false)`,
        created_at: usuarios.created_at,
        updated_at: usuarios.updated_at,
        nombres: sql<string>`COALESCE(${personal.nombres}, ${usuarios.username})`,
        apellidos: sql<string>`COALESCE(${personal.apellidos}, '')`,
        firma_url: personal.firma_url,
        rol_nombre: roles.nombre,
        rol_descripcion: roles.descripcion,
      })
      .from(usuarios)
      .innerJoin(roles, eq(usuarios.rol_id, roles.id))
      .leftJoin(personal, eq(usuarios.personal_id, personal.id))
      .orderBy(desc(usuarios.created_at));

    return await Promise.all(
      userRows.map(async (u) => {
        const userSedes = await this.getUserSedes(u.id);
        return {
          ...u,
          sedes: userSedes,
        } as any;
      })
    );
  }

  /**
   * Obtener usuario por ID
   */
  async getUserById(id: number): Promise<UsuarioConRol> {
    const [user] = await db
      .select({
        id: usuarios.id,
        username: usuarios.username,
        email: usuarios.email,
        rol_id: usuarios.rol_id,
        personal_id: usuarios.personal_id,
        activo: usuarios.activo,
        two_factor_enabled: sql<boolean>`COALESCE(${usuarios.two_factor_enabled}, false)`,
        created_at: usuarios.created_at,
        updated_at: usuarios.updated_at,
        nombres: sql<string>`COALESCE(${personal.nombres}, ${usuarios.username})`,
        apellidos: sql<string>`COALESCE(${personal.apellidos}, '')`,
        firma_url: personal.firma_url,
        rol_nombre: roles.nombre,
        rol_descripcion: roles.descripcion,
      })
      .from(usuarios)
      .innerJoin(roles, eq(usuarios.rol_id, roles.id))
      .leftJoin(personal, eq(usuarios.personal_id, personal.id))
      .where(eq(usuarios.id, id));

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    const userSedes = await this.getUserSedes(id);
    return {
      ...user,
      sedes: userSedes,
    } as any;
  }

  /**
   * Actualizar usuario
   */
  async updateUser(id: number, userData: UpdateUserRequest): Promise<Usuario> {
    const updateData: Partial<typeof usuarios.$inferInsert> = {};

    if (userData.email !== undefined) updateData.email = userData.email;
    if (userData.password !== undefined) {
      updateData.password_hash = await bcrypt.hash(userData.password, 10);
    }
    if (userData.rol_id !== undefined) updateData.rol_id = userData.rol_id;
    if (userData.personal_id !== undefined) updateData.personal_id = userData.personal_id;
    if (userData.activo !== undefined) updateData.activo = userData.activo;

    if (Object.keys(updateData).length === 0 && userData.sede_ids === undefined) {
      throw new Error('No hay campos para actualizar');
    }

    return await db.transaction(async (tx) => {
      if (userData.sede_ids !== undefined) {
        await tx.delete(usuariosSedes).where(eq(usuariosSedes.usuario_id, id));
        if (userData.sede_ids.length > 0) {
          await tx.insert(usuariosSedes).values(
            userData.sede_ids.map((sede_id) => ({
              usuario_id: id,
              sede_id,
            }))
          );
        }
      }

      if (Object.keys(updateData).length > 0) {
        updateData.updated_at = sql`CURRENT_TIMESTAMP` as any;

        const [updated] = await tx
          .update(usuarios)
          .set(updateData)
          .where(eq(usuarios.id, id))
          .returning({
            id: usuarios.id,
            username: usuarios.username,
            email: usuarios.email,
            rol_id: usuarios.rol_id,
            personal_id: usuarios.personal_id,
            activo: usuarios.activo,
            identity_id: usuarios.identity_id,
            created_at: usuarios.created_at,
            updated_at: usuarios.updated_at,
          });

        if (!updated) {
          throw new Error('Usuario no encontrado');
        }

        // Sincronizar en Master DB
        if (updated.identity_id) {
          if (updateData.password_hash) {
            await masterDb
              .update(masterIdentities)
              .set({
                password_hash: updateData.password_hash,
                password_changed_at: new Date(),
              })
              .where(eq(masterIdentities.id, updated.identity_id));
          }

          if (updateData.activo !== undefined) {
            let currentTenantId: string | null = null;
            try {
              const ctx = getTenantContext();
              currentTenantId = ctx?.tenantId || null;
            } catch {
              currentTenantId = null;
            }

            if (currentTenantId) {
              await masterDb
                .update(masterMemberships)
                .set({
                  status: updateData.activo ? 'ACTIVE' : 'SUSPENDED',
                  updated_at: new Date(),
                })
                .where(
                  and(
                    eq(masterMemberships.identity_id, updated.identity_id),
                    eq(masterMemberships.tenant_id, currentTenantId)
                  )
                );
            }
          }
        }

        return updated as any;
      }

      const [current] = await tx
        .select({
          id: usuarios.id,
          username: usuarios.username,
          email: usuarios.email,
          rol_id: usuarios.rol_id,
          personal_id: usuarios.personal_id,
          activo: usuarios.activo,
          created_at: usuarios.created_at,
          updated_at: usuarios.updated_at,
        })
        .from(usuarios)
        .where(eq(usuarios.id, id));

      if (!current) throw new Error('Usuario no encontrado');
      return current as any;
    });
  }

  /**
   * Eliminar usuario (soft delete)
   */
  async deleteUser(id: number): Promise<void> {
    const [user] = await db
      .update(usuarios)
      .set({ activo: false, updated_at: sql`CURRENT_TIMESTAMP` as any })
      .where(eq(usuarios.id, id))
      .returning({ id: usuarios.id, identity_id: usuarios.identity_id });

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    if (user.identity_id) {
      let currentTenantId: string | null = null;
      try {
        const ctx = getTenantContext();
        currentTenantId = ctx?.tenantId || null;
      } catch {
        currentTenantId = null;
      }

      if (currentTenantId) {
        await masterDb
          .update(masterMemberships)
          .set({ status: 'SUSPENDED', updated_at: new Date() })
          .where(
            and(
              eq(masterMemberships.identity_id, user.identity_id),
              eq(masterMemberships.tenant_id, currentTenantId)
            )
          );
      }
    }
  }

  /**
   * Obtener todos los roles
   */
  async getAllRoles(): Promise<{ id: number; nombre: string; descripcion: string | null; activo: boolean | null }[]> {
    return db
      .select({
        id: roles.id,
        nombre: roles.nombre,
        descripcion: roles.descripcion,
        activo: roles.activo,
      })
      .from(roles)
      .where(eq(roles.activo, true))
      .orderBy(asc(roles.nombre));
  }

  // ============================================
  // HELPERS
  // ============================================

  private generateAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, process.env.JWT_ACCESS_SECRET || 'access_secret', {
      expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '8h') as string,
    } as jwt.SignOptions);
  }

  private generateRefreshToken(payload: JwtPayload): string {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || 'refresh_secret', {
      expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as string,
    } as jwt.SignOptions);
  }

  async recordAuthEvent(
    event: string,
    identityId?: string | null,
    tenantId?: string | null,
    ip?: string | null,
    userAgent?: string | null,
    detail?: any
  ): Promise<void> {
    try {
      await masterDb.insert(masterAuthEvents).values({
        event,
        identity_id: identityId || null,
        tenant_id: tenantId || null,
        ip: ip || null,
        user_agent: userAgent || null,
        detail: detail || null,
      });
    } catch (err) {
      console.warn('⚠️ Error al registrar auth_event en Master DB:', err);
    }
  }
}

export const authService = new AuthService();
