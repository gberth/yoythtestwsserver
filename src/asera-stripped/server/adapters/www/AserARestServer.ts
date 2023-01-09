import { StreamDef } from "../../types";

import AserAStream from "../../AserAStream";
import AserAMessage from "../../AserAMessage";
import { asyncEvent, asyncEventResponse } from "../../AserAAsync";

import restify from "restify";
import { AMessage } from "../../..";

type RouteDef = {
  route: string;
  action?: string;
  type?: string;
  raw?: boolean;
  json?: boolean
};

class AserARestServer extends AserAStream {
  server: any;
  handleRequest: Function;
  initiateServer: Function;
  asyncEvent: Function;
  asyncEventResponse: Function;
  port: Number
  constructor(
    streamDef: StreamDef,
    outputStream: AserAStream,
    motherId: string
  ) {
    super(streamDef, outputStream, motherId);

    this.server = restify.createServer({
      name: this.config.name,
      version: this.config.version
    });
    this.server.use(restify.plugins.acceptParser(this.server.acceptable));
    this.server.use(restify.plugins.queryParser());
    this.server.use(restify.plugins.bodyParser());
    this.handleRequest = handleRequest.bind(this);
    this.initiateServer = initiateServer.bind(this);
    this.asyncEvent = asyncEvent.bind(this);
    this.asyncEventResponse = asyncEventResponse.bind(this);
    this.port = process.env.PORT || process.env[this.config.port] || (isNaN(this.config.port) ? 8001 : this.config.port);

    this.initiateServer();

    const _this = this;

    this.on("data", function (msg: AserAMessage) {
      try {
        // find request, and resolve
        _this.asyncEventResponse({ msg: msg });
      } catch (error) {
        _this.catchError({ msg: null, error: error, text: "Rest error" });
      }
    });
  }
}
function initiateServer() {
  // @ts-ignore
  const stream = this;

  stream.config.routes.forEach((routeDef: RouteDef) => {
    stream.log.info(
      "Route ".concat(stream.config.baseroute.concat(routeDef.route))
    );
    stream.server[routeDef.action || "post"](
      stream.config.baseroute.concat(routeDef.route),
      function (req: any, res: any, next: any) {
        stream.handleRequest(req, res, next, routeDef.type="", routeDef.raw=true, routeDef.json=false);
      }
    );
  });
  stream.server.listen(stream.port, function () {
    stream.log.info(`${stream.server.name} listening at ${stream.server.url}`);
  });
}
function handleRequest(req: any, res: any, next: any, type: string, raw: boolean, json:boolean) {
  // @ts-ignore
  const stream = this;
  let returnData: Array<any> = [];
  const keepData: Function = () => {
    return (keep: AserAMessage) => {
      returnData.push(keep.message_payload());
    };
  };
  const asyncEventError: Function = () => {
    return (e: any) => {
      res.send(new Error("Server Error " + e));
      next();
      stream.catchError({ msg: null, error: e, text: "AsyncEventError" });
    };
  };
  let msg = null
  let payload = null
  let msgtype = null
  if (!raw && json) {
    msg = new AserAMessage(req.body)
    payload = msg.message_payload()
    msgtype = msg.type() 
  } else {
    payload = stream.config.bodyonly ? { ...req.body } : { ...req };
    msgtype = payload[type] && typeof payload[type] === "string"
          ? payload[type]
          : type
  }
  Promise.all([
    stream.asyncEvent({
      msg,
      type: msgtype,
      parameters: payload,
      receiveData: keepData(),
      errorFunction: asyncEventError()
    })
  ])
    .then(() => {
      res.send(returnData.length === 1 ? returnData[0] : returnData);
      next();
    })
    .catch(e => {
      stream.catchError({ msg: null, error: e, text: "Promise All error" });
    });
}

export default AserARestServer;
