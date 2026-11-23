const values = new Map<string, string>();
export const signatureStorageMock = {
  getItem: async (key: string): Promise<string | null> => values.get(key) ?? null,
  setItem: async (key: string, value: string): Promise<void> => { await Promise.resolve(); values.set(key, value); },
};
export default signatureStorageMock;
