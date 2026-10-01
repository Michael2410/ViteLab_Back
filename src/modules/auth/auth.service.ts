import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { eq, and, or, asc, desc, sql } from 'drizzle-orm';
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
} from '../../db';
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
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const { username, password } = credentials;

    // Buscar usuario con rol y personal
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
      .where(and(eq(usuarios.username, username), eq(usuarios.activo, true)));

    if (!user) {
      throw new Error('Usuario o contraseña incorrectos');
    }

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Usuario o contraseña incorrectos');
    }

    // 2FA - CASO A: Usuario ya tiene 2FA configurado y activo
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

    // 2FA - CASO B: Usuario requiere vincular 2FA por primera vez (Onboarding TOTP)
    const secret = generateSecret();
    const otpauth = generateURI({ issuer: 'ViteLab', label: user.username, secret });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

    // Guardar secreto temporal para verificar en el paso 2
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

    if (payload.stage !== '2fa_setup_pending') {
      throw new Error('Token de configuración no válido.');
    }

    const [user] = await db
      .select({
        id: usuarios.id,
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
      .where(and(eq(usuarios.id, payload.userId), eq(usuarios.activo, true)));

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

    // Activar 2FA de forma definitiva
    await db
      .update(usuarios)
      .set({
        two_factor_enabled: true,
        two_factor_secret: user.two_factor_temp_secret,
        two_factor_temp_secret: null,
        two_factor_backup_codes: JSON.stringify(backupCodes),
      })
      .where(eq(usuarios.id, user.id));

    return this.completeLoginSession(user, backupCodes);
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

    const [user] = await db
      .select({
        id: usuarios.id,
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
      .where(and(eq(usuarios.id, payload.userId), eq(usuarios.activo, true)));

    if (!user || !user.two_factor_secret) {
      throw new Error('Usuario no encontrado o 2FA no habilitado.');
    }

    // 1. Probar como código TOTP dinámico de 6 dígitos
    let isValid = verifySync({ token: code.trim(), secret: user.two_factor_secret, epochTolerance: 30 }).valid;

    // 2. Si no es válido como TOTP, verificar si es un código de respaldo
    if (!isValid && user.two_factor_backup_codes) {
      try {
        const backupCodes: string[] = JSON.parse(user.two_factor_backup_codes);
        const normalizedInput = code.trim().toUpperCase().replace(/[\s-]/g, '');
        const foundIndex = backupCodes.findIndex(
          (b) => b.replace(/-/g, '').toUpperCase() === normalizedInput
        );

        if (foundIndex !== -1) {
          isValid = true;
          // Eliminar el código usado (single-use)
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
   * Completar sesión de login y emitir tokens JWT
   */
  private async completeLoginSession(user: any, backupCodes?: string[]): Promise<LoginResponse> {
    const userSedes = await this.getUserSedes(user.id);
    const userPermisos = await this.getUserPermisos(user.rol_id);

    const accessToken = this.generateAccessToken({
      userId: user.id,
      username: user.username,
      email: user.email,
      rolId: user.rol_id,
    });

    const refreshToken = this.generateRefreshToken({
      userId: user.id,
      username: user.username,
      email: user.email,
      rolId: user.rol_id,
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

    const {
      password_hash: _,
      refresh_token: __,
      refresh_token_expires_at: ___,
      two_factor_secret: ____,
      two_factor_temp_secret: _____,
      two_factor_backup_codes: ______,
      ...userWithoutSensitiveData
    } = user;

    return {
      requires2FA: false,
      user: {
        ...userWithoutSensitiveData,
        two_factor_enabled: true,
        sedes: userSedes,
        permisos: userPermisos,
      } as any,
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
      });

      const refreshToken = this.generateRefreshToken({
        userId: user.id,
        username: user.username,
        email: user.email,
        rolId: user.rol_id,
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

    return await db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(usuarios)
        .values({
          username,
          email,
          password_hash,
          rol_id,
          personal_id: personal_id || null,
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
            created_at: usuarios.created_at,
            updated_at: usuarios.updated_at,
          });

        if (!updated) {
          throw new Error('Usuario no encontrado');
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
    const rows = await db
      .update(usuarios)
      .set({ activo: false, updated_at: sql`CURRENT_TIMESTAMP` as any })
      .where(eq(usuarios.id, id))
      .returning({ id: usuarios.id });

    if (rows.length === 0) {
      throw new Error('Usuario no encontrado');
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
}

export const authService = new AuthService();
