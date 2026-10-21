import type { AtlassianFetch } from "../types.js";
import { throwAtlassianError } from "../errors.js";
import type {
  AssetsClient,
  AssetObject,
  AqlSearchResponse,
  AssetHistoryEntry,
  AssetSchema,
  AssetObjectType,
} from "./types.js";

const INSIGHT_BASE = "/rest/insight/1.0";

export class InsightAssetsClient implements AssetsClient {
  constructor(private fetch: AtlassianFetch) {}

  async searchAql(
    query: string,
    options?: { schemaId?: number; page?: number; resultsPerPage?: number },
  ): Promise<AqlSearchResponse> {
    const params = new URLSearchParams({
      iql: query,
      page: String(options?.page ?? 1),
      resultPerPage: String(options?.resultsPerPage ?? 25),
      includeAttributes: "true",
    });
    if (options?.schemaId) params.set("objectSchemaId", String(options.schemaId));

    const resp = await this.fetch(`${INSIGHT_BASE}/iql/objects?${params}`);
    if (!resp.ok) throw new Error(`AQL search failed: ${resp.status} ${resp.statusText}`);
    const data = (await resp.json()) as AqlSearchResponse;

    // Enrich attributes with names from response-level definitions
    if (data.objectTypeAttributes?.length) {
      const attrMap = new Map(data.objectTypeAttributes.map((a) => [a.id, a]));
      for (const obj of data.objectEntries) {
        for (const attr of obj.attributes) {
          if (!attr.objectTypeAttribute) {
            const def = attrMap.get(attr.objectTypeAttributeId);
            if (def) attr.objectTypeAttribute = { id: def.id, name: def.name, type: def.type };
          }
          // Strip nested attributes from references to prevent circular refs
          for (const val of attr.objectAttributeValues) {
            if (val.referencedObject) {
              const ref = val.referencedObject as Record<string, unknown>;
              delete ref["attributes"];
              delete ref["avatar"];
              delete ref["_links"];
            }
          }
        }
      }
    }
    return data;
  }

  async getObject(objectId: number): Promise<AssetObject> {
    const resp = await this.fetch(`${INSIGHT_BASE}/object/${objectId}`);
    if (!resp.ok)
      await throwAtlassianError(resp, `Failed to get asset object ${objectId}`);
    return (await resp.json()) as AssetObject;
  }

  async getObjectHistory(objectId: number): Promise<AssetHistoryEntry[]> {
    const resp = await this.fetch(`${INSIGHT_BASE}/object/${objectId}/history`);
    if (!resp.ok)
      throw new Error(
        `Failed to get asset history for ${objectId}: ${resp.status} ${resp.statusText}`,
      );
    return (await resp.json()) as AssetHistoryEntry[];
  }

  async getObjectConnectedTickets(
    objectId: number,
  ): Promise<Array<{ key: string; title: string; status: string; type: string }>> {
    const resp = await this.fetch(`${INSIGHT_BASE}/objectconnectedtickets/${objectId}/tickets`);
    if (!resp.ok)
      throw new Error(
        `Failed to get connected tickets for ${objectId}: ${resp.status} ${resp.statusText}`,
      );
    const data = (await resp.json()) as {
      tickets: Array<{ key: string; title: string; status: string; type: string }>;
    };
    return data.tickets ?? [];
  }

  async listSchemas(): Promise<AssetSchema[]> {
    const resp = await this.fetch(`${INSIGHT_BASE}/objectschema/list`);
    if (!resp.ok)
      await throwAtlassianError(resp, `Failed to list asset schemas`);
    const data = (await resp.json()) as { objectschemas: AssetSchema[] };
    return data.objectschemas;
  }

  async listObjectTypes(schemaId: number): Promise<AssetObjectType[]> {
    const resp = await this.fetch(`${INSIGHT_BASE}/objectschema/${schemaId}/objecttypes`);
    if (!resp.ok)
      throw new Error(
        `Failed to list object types for schema ${schemaId}: ${resp.status} ${resp.statusText}`,
      );
    return (await resp.json()) as AssetObjectType[];
  }
}
