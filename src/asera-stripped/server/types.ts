import AserAMessage from "./AserAMessage";
import AserAStream from "./AserAStream";

export type RequestParameters = NVP;

export type AsyncRequestParameters = {
  msg: AserAMessage | null;
  type: string;
  parameters: RequestParameters;
  receiveData?: Function;
  ackData?: Function;
  errorFunction: Function;
  timeout_ms?: number; //ms
};

export type AsyncResponseParameters = {
  msg: AserAMessage;
};

export type AsyncEventData = {
  status: string;
  msg: AserAMessage | null;
  timeout: NodeJS.Timer;
  receiveData: Function | null;      // @ts-ignore

  ackData: Function | null;
  errorFunction: Function;
  resolve: Function;
  reject: Function;
  parameters: any;
};

export type AserAItem = {
  aItem: {
    aMetaData: {
      aId: string;
      aType: string;
      aVersion?: number;
      aCreator?: string;
      aCreated?: string;
      aCreatedTx?: string;
      aOwner: string;
      aModified?: string;
      aModifiedTx?: string;
      aStatus?: string;
      aImg?: string;
      any?: any;
      aVersionLog?: string;
    };
    aContent: Payload;
  };
  _id?: string;
};
export type RequestData = | NVP | {
  stream_id?: string;
  request_id?: string | undefined | null;
  requestType?: string;
  request_id_trace?: Array<string>;
  server?: string; 
  [key: string]: any;
};

export enum RequestType {
  ACK = "ACK",
  RESPONSE = "RESPONSE",
  RESPONSE_WITH_ACK = "RESPONSE_WITH_ACK",
  REQUEST = "REQUEST",
  ERROR = "ERROR"
}
export type MessageData = {
  message_id: string;
  type: string;
  original_message_id?: string;
  previous_message_id?: string;
  original_type?: string;
  previous_type?: string;
  input_type?: string;
  request_data: RequestData;
  creator?: string;
  created?: string;
  message_versionLlog?: string;
  [key: string]: any;
};
export type Payload =
  | NVP
  | {
    items?: Array<any>;
    collections?: [];
    searchString?: string;
    aItem?: AserAItem;
    distributions?: { [key: string]: any };
    log?: any;
  }
  | Array<any>
  | string;

export type AserAMessageDef = {
  message_data: MessageData;
  identity_data: {
    [key: string]: any | null;
  };
  payload: Payload;
};
export type CreateMessageWithThisAsMother = (msg: AserAMessage) => AserAMessage;
// helpers

export type AserAErrorDef = {
  error: Error;
  msg?: AserAMessage;
  rest?: any;
};

export type AckParameters = {
  msg: AserAMessage;
  msg_type?: string;
  type?: string;
  response: boolean;
  payload?: {};
  error?: boolean;
};

export type SslOptions = {
  rejectUnauthorized: boolean | undefined;
  ca: string | undefined;
  key: string | undefined;
  cert: string | undefined;
};

export type AserACatchDef = (x0: AserAErrorDef) => void;
export type NVP = {
  [key: string]: any;
};

// stream

export type StreamConfig = {
  streams: Array<StreamDef>;
  dispatcherMessages: {} | undefined | null;
  any: any | undefined | null;
  systemIdentifier: string | null;
};

export type StreamDef = {
  streamId: string;
  streamClass: AserAStream;
  streamConfig: StreamConfig;
};

export enum LOGLEVELS {
  trace = 10,
  debug = 20,
  info = 30,
  warn = 40,
  error = 50,
  fatal = 60
}

export type AseraStreamEntity = {
  entity: any;
};

export type AseraStreamDoc = {
  entity: any;
  stream: any;
  sources: Array<AseraStreamEntity>;
  sinks: Array<AseraStreamEntity>;
  links: Array<AseraStreamEntity>;
};

export type MysqlQuery = {
  sql: string;
  values: any[];
  status?: boolean;
  finished?: boolean;
  blocksize?: number;
};
export type QueryResult = {
  data: any[];
  finished: boolean;
  status_ok?: boolean;
  queue: number;
  done: number;
  noof: number;
};

export type MysqlPayload = {
  transaction?: boolean;
  queries: MysqlQuery[];
};

export type BigQQuery = {
  sql: string;
  parameters: { [key: string]: any };
  status?: boolean;
  finished?: boolean;
};
export type BigQueryResult = {
  data: any[];
  finished: boolean;
  status_ok?: boolean;
};

export type BigQueryPayload = {
  queries: BigQQuery[];
};
