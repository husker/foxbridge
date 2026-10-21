export interface AssetAttributeValue {
  value: unknown;
  displayValue: string;
  referencedObject?: {
    id: number;
    label: string;
    objectKey: string;
    objectType: { id: number; name: string };
  };
}

export interface AssetAttribute {
  id: number;
  objectTypeAttributeId: number;
  objectAttributeValues: AssetAttributeValue[];
  objectTypeAttribute?: {
    id: number;
    name: string;
    type: number;
    description?: string;
  };
}

export interface AssetObjectType {
  id: number;
  name: string;
  description?: string;
  parentObjectTypeId?: number;
  objectSchemaId: number;
  objectCount?: number;
}

export interface AssetObject {
  id: number;
  label: string;
  objectKey: string;
  objectType: AssetObjectType;
  created: string;
  updated: string;
  attributes: AssetAttribute[];
}

export interface AqlSearchResponse {
  objectEntries: AssetObject[];
  totalFilterCount: number;
  pageNumber: number;
  pageSize: number;
  objectTypeAttributes?: Array<{ id: number; name: string; type: number }>;
}

export interface AssetSchema {
  id: number;
  name: string;
  objectSchemaKey: string;
  description?: string;
  objectCount?: number;
  objectTypeCount?: number;
}

export interface AssetHistoryEntry {
  id: number;
  affectedAttribute: string;
  oldValue: string;
  newValue: string;
  actor: { name: string; displayName: string };
  created: string;
  type: number;
}

export interface AssetsClient {
  searchAql(query: string, options?: { schemaId?: number; page?: number; resultsPerPage?: number }): Promise<AqlSearchResponse>;
  getObject(objectId: number): Promise<AssetObject>;
  getObjectHistory(objectId: number): Promise<AssetHistoryEntry[]>;
  getObjectConnectedTickets(objectId: number): Promise<Array<{ key: string; title: string; status: string; type: string }>>;
  listSchemas(): Promise<AssetSchema[]>;
  listObjectTypes(schemaId: number): Promise<AssetObjectType[]>;
}
