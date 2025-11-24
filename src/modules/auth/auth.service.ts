import pool from '../../config/database';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {
  Usuario,
  UsuarioConRol,
  LoginCredentials,
  LoginResponse,
  JwtPayload,
  CreateUserRequest,
  UpdateUserRequest,
  UsuarioConPermisos,
} from './auth.types';

export class AuthService {
  // ============================================
  // AUTENTICACIÓN
  // ============================================

  /**
   * Login de usuario
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const { username, password } = credentials;

    // Buscar usuario con rol
    const query = `
      SELECT u.*, r.nombre as rol_nombre, r.descripcion as rol_descripcion
      FROM usuarios u
      INNER JOIN roles r ON u.rol_id = r.id
      WHERE u.username = $1 AND u.activo = true
    `;

    const result = await pool.query(query, [username]);

    if (result.rows.length === 0) {
      throw new Error('Usuario o contraseña incorrectos');
    }

    const user = result.rows[0];

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      throw new Error('Usuario o contraseña incorrectos');
    }

    // Generar tokens
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

    // Guardar refresh token en BD
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 días

    await pool.query(
      'UPDATE usuarios SET refresh_token = $1, refresh_token_expires_at = $2 WHERE id = $3',
      [refreshToken, expiresAt, user.id]
    );

    // Retornar respuesta (sin datos sensibles)
    const { password_hash, refresh_token, refresh_token_expires_at, ...userWithoutSensitiveData } = user;

    return {
      user: userWithoutSensitiveData,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh token
   */
  async refreshToken(oldRefreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // Verificar token
      const decoded = jwt.verify(
        oldRefreshToken,
        process.env.JWT_REFRESH_SECRET || 'refresh_secret'
      ) as JwtPayload;

      // Buscar usuario y verificar que el token coincida
      const query = `
        SELECT id, username, email, rol_id, refresh_token, refresh_token_expires_at
        FROM usuarios
        WHERE id = $1 AND activo = true
      `;

      const result = await pool.query(query, [decoded.userId]);

      if (result.rows.length === 0) {
        throw new Error('Usuario no encontrado');
      }

      const user = result.rows[0];

      // Verificar que el token coincida y no esté expirado
      if (user.refresh_token !== oldRefreshToken) {
        throw new Error('Token inválido');
      }

      if (new Date() > new Date(user.refresh_token_expires_at)) {
        throw new Error('Refresh token expirado');
      }

      // Generar nuevos tokens
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

      // Actualizar refresh token en BD
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await pool.query(
        'UPDATE usuarios SET refresh_token = $1, refresh_token_expires_at = $2 WHERE id = $3',
        [refreshToken, expiresAt, user.id]
      );

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
    await pool.query(
      'UPDATE usuarios SET refresh_token = NULL, refresh_token_expires_at = NULL WHERE id = $1',
      [userId]
    );
  }

  /**
   * Obtener usuario con permisos
   */
  async getUserWithPermissions(userId: number): Promise<UsuarioConPermisos> {
    // Obtener usuario con rol
    const userQuery = `
      SELECT u.*, r.nombre as rol_nombre, r.descripcion as rol_descripcion
      FROM usuarios u
      INNER JOIN roles r ON u.rol_id = r.id
      WHERE u.id = $1 AND u.activo = true
    `;

    const userResult = await pool.query(userQuery, [userId]);

    if (userResult.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }

    const user = userResult.rows[0];

    // Obtener permisos del rol
    const permissionsQuery = `
      SELECT p.codigo
      FROM roles_permisos rp
      INNER JOIN permisos p ON rp.permiso_id = p.id
      WHERE rp.rol_id = $1
    `;

    const permissionsResult = await pool.query(permissionsQuery, [user.rol_id]);
    const permisos = permissionsResult.rows.map((row) => row.codigo);

    // Remover datos sensibles
    const { password_hash, refresh_token, refresh_token_expires_at, ...userWithoutSensitiveData } = user;

    return {
      ...userWithoutSensitiveData,
      permisos,
    };
  }

  // ============================================
  // GESTIÓN DE USUARIOS
  // ============================================

  /**
   * Crear usuario
   */
  async createUser(userData: CreateUserRequest): Promise<Usuario> {
    const { username, email, password, nombres, apellidos, rol_id, firma_url } = userData;

    // Verificar si username ya existe
    const existingUser = await pool.query('SELECT id FROM usuarios WHERE username = $1 OR email = $2', [
      username,
      email,
    ]);

    if (existingUser.rows.length > 0) {
      throw new Error('El usuario o email ya existe');
    }

    // Hash de contraseña
    const password_hash = await bcrypt.hash(password, 10);

    // Insertar usuario
    const query = `
      INSERT INTO usuarios (username, email, password_hash, nombres, apellidos, rol_id, firma_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, username, email, nombres, apellidos, rol_id, firma_url, activo, created_at, updated_at
    `;

    const result = await pool.query(query, [username, email, password_hash, nombres, apellidos, rol_id, firma_url]);

    return result.rows[0];
  }

  /**
   * Obtener todos los usuarios
   */
  async getAllUsers(): Promise<UsuarioConRol[]> {
    const query = `
      SELECT u.*, r.nombre as rol_nombre, r.descripcion as rol_descripcion
      FROM usuarios u
      INNER JOIN roles r ON u.rol_id = r.id
      ORDER BY u.created_at DESC
    `;

    const result = await pool.query(query);

    // Remover datos sensibles
    return result.rows.map((user) => {
      const { password_hash, refresh_token, refresh_token_expires_at, ...userWithoutSensitiveData } = user;
      return userWithoutSensitiveData;
    });
  }

  /**
   * Obtener usuario por ID
   */
  async getUserById(id: number): Promise<UsuarioConRol> {
    const query = `
      SELECT u.*, r.nombre as rol_nombre, r.descripcion as rol_descripcion
      FROM usuarios u
      INNER JOIN roles r ON u.rol_id = r.id
      WHERE u.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }

    const { password_hash, refresh_token, refresh_token_expires_at, ...userWithoutSensitiveData } = result.rows[0];

    return userWithoutSensitiveData;
  }

  /**
   * Actualizar usuario
   */
  async updateUser(id: number, userData: UpdateUserRequest): Promise<Usuario> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Construir query dinámicamente
    if (userData.email !== undefined) {
      fields.push(`email = $${paramIndex++}`);
      values.push(userData.email);
    }

    if (userData.password !== undefined) {
      const password_hash = await bcrypt.hash(userData.password, 10);
      fields.push(`password_hash = $${paramIndex++}`);
      values.push(password_hash);
    }

    if (userData.nombres !== undefined) {
      fields.push(`nombres = $${paramIndex++}`);
      values.push(userData.nombres);
    }

    if (userData.apellidos !== undefined) {
      fields.push(`apellidos = $${paramIndex++}`);
      values.push(userData.apellidos);
    }

    if (userData.rol_id !== undefined) {
      fields.push(`rol_id = $${paramIndex++}`);
      values.push(userData.rol_id);
    }

    if (userData.firma_url !== undefined) {
      fields.push(`firma_url = $${paramIndex++}`);
      values.push(userData.firma_url);
    }

    if (userData.activo !== undefined) {
      fields.push(`activo = $${paramIndex++}`);
      values.push(userData.activo);
    }

    if (fields.length === 0) {
      throw new Error('No hay campos para actualizar');
    }

    // Agregar ID al final
    values.push(id);

    const query = `
      UPDATE usuarios
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, username, email, nombres, apellidos, rol_id, firma_url, activo, created_at, updated_at
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }

    return result.rows[0];
  }

  /**
   * Eliminar usuario (soft delete)
   */
  async deleteUser(id: number): Promise<void> {
    const result = await pool.query('UPDATE usuarios SET activo = false WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      throw new Error('Usuario no encontrado');
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  /**
   * Generar Access Token
   */
  private generateAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, process.env.JWT_ACCESS_SECRET || 'access_secret', {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    });
  }

  /**
   * Generar Refresh Token
   */
  private generateRefreshToken(payload: JwtPayload): string {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || 'refresh_secret', {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    });
  }
}
