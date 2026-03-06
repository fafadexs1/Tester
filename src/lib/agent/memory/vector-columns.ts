export const VECTOR_COLUMN_SPECS = [
  { column: 'embedding', dimension: 1536 },
  { column: 'embedding_768', dimension: 768 },
  { column: 'embedding_384', dimension: 384 },
] as const;

export type VectorColumnName = (typeof VECTOR_COLUMN_SPECS)[number]['column'];

export const getVectorColumnSpecByDimension = (dimension?: number | null) =>
  VECTOR_COLUMN_SPECS.find(spec => spec.dimension === dimension);

export const getVectorColumnForEmbedding = (embedding?: number[] | null): VectorColumnName | null =>
  getVectorColumnSpecByDimension(embedding?.length)?.column ?? null;

export const getVectorColumnDefinitions = (): string[] =>
  VECTOR_COLUMN_SPECS.map(spec => `${spec.column} vector(${spec.dimension})`);

export const getVectorIndexDefinitions = (tableName: string): string[] =>
  VECTOR_COLUMN_SPECS.map(spec =>
    `CREATE INDEX IF NOT EXISTS idx_${tableName}_${spec.column} ON ${tableName} USING ivfflat (${spec.column} vector_cosine_ops);`
  );

export const createVectorColumnPayload = (embedding?: number[] | null): Record<VectorColumnName, string | null> => {
  const payload = Object.fromEntries(
    VECTOR_COLUMN_SPECS.map(spec => [spec.column, null])
  ) as Record<VectorColumnName, string | null>;

  const targetColumn = getVectorColumnForEmbedding(embedding);
  if (targetColumn && embedding) {
    payload[targetColumn] = JSON.stringify(embedding);
  }

  return payload;
};
