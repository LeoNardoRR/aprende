import { supabase } from './supabase';

/** New RPC boundary until database types are regenerated from the local schema. */
export async function institutionalRpc<T>(
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const client = supabase as unknown as {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => PromiseLike<{ data: T; error: { message: string } | null }>;
  };
  const result = await client.rpc(name, args);
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
export function operationError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Falha inesperada.';
  if (/not authorized|permission denied/i.test(message))
    return 'Seu vínculo não permite esta operação neste escopo.';
  return message;
}
