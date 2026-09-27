import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { configuracionSistema } from '../../db';

export type ConfiguracionSistema = InferSelectModel<typeof configuracionSistema>;
export type UpdateConfiguracionInput = Partial<InferInsertModel<typeof configuracionSistema>>;

