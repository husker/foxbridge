export interface ConfluencePage {
  id: string;
  title: string;
  spaceKey: string;
  body: string;
  version: number;
  status: string;
  created: string;
  updated: string;
  authorId: string;
}

export interface ConfluenceSpace {
  id: string;
  key: string;
  name: string;
  description: string;
  type: string;
}

export interface ConfluenceSearchResult {
  results: ConfluencePage[];
  total: number;
  maxResults: number;
  startAt: number;
}

export interface ConfluenceComment {
  id: string;
  body: string;
  author: string;
  created: string;
  updated: string;
}

export interface ConfluenceLabel {
  id: string;
  name: string;
  prefix: string;
}

export interface ConfluenceAttachment {
  id: string;
  title: string;
  filename: string;
  mediaType: string;
  fileSize: number;
  downloadUrl: string;
  created: string;
}

export interface ConfluenceContentProperty {
  key: string;
  value: unknown;
  version: number;
}

export interface ConfluenceClient {
  // Search
  search(cql: string, maxResults?: number): Promise<ConfluenceSearchResult>;

  // Pages CRUD
  getPage(pageId: string): Promise<ConfluencePage>;
  createPage(spaceKey: string, title: string, body: string, parentId?: string): Promise<ConfluencePage>;
  updatePage(pageId: string, title: string, body: string, version: number): Promise<ConfluencePage>;
  deletePage(pageId: string): Promise<void>;

  // Spaces
  listSpaces(maxResults?: number): Promise<ConfluenceSpace[]>;

  // Comments
  listComments(pageId: string): Promise<ConfluenceComment[]>;
  addComment(pageId: string, body: string): Promise<ConfluenceComment>;

  // Labels
  listLabels(pageId: string): Promise<ConfluenceLabel[]>;
  addLabel(pageId: string, label: string): Promise<void>;
  removeLabel(pageId: string, label: string): Promise<void>;

  // Attachments
  listAttachments(pageId: string): Promise<ConfluenceAttachment[]>;
  downloadAttachment(downloadUrl: string): Promise<{ filename: string; content: Buffer }>;
  addAttachment(pageId: string, filename: string, content: Buffer): Promise<ConfluenceAttachment>;

  // Content Properties
  getContentProperty(pageId: string, key: string): Promise<ConfluenceContentProperty | null>;
  setContentProperty(pageId: string, key: string, value: unknown): Promise<void>;

  // Inline Comments
  addInlineComment(pageId: string, body: string, selectionText: string): Promise<ConfluenceComment>;
  getInlineComments(pageId: string): Promise<ConfluenceComment[]>;

  // Page Hierarchy
  getPageDescendants(pageId: string, maxResults?: number): Promise<ConfluencePage[]>;

  // Space Pages
  getSpacePages(spaceKey: string, maxResults?: number, title?: string): Promise<ConfluencePage[]>;
}
