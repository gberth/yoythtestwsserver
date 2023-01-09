import { AserAMessageDef, RequestData, StreamDef } from "../../types";
import AserAStream from "../../AserAStream";
import AserAMessage from "../../AserAMessage";

import { aId } from "../../AserAHelpers";
import { Stream } from "stream";

const WebSocket = require("ws");
const WebSocketServer = WebSocket.Server;

class AserAWebSocketServerLight extends AserAStream {
  handle_message: Function;
  send: Function;
  connections: {};
  wsconnection: {};
  connectionsData: {};
  connectionct: number;
  maxconnections: number;
  proxy_login_type: string;
  ping_type: string;
  proxy_servers: {};
  allowed_proxy_servers: [];
  connect: any;
  wss: any;
  initialAserAData: any;
  initiated: boolean;
  requests: {}
  raw: boolean
  raw_type: string | undefined

  constructor(
    streamDef: StreamDef,

    outputStream: AserAStream,
    motherId: string
  ) {
    super(streamDef, outputStream, motherId);
    this.handle_message = handle_message.bind(this);
    this.connect = connect.bind(this);
    let port = process.env.PORT || process.env[this.config.port] || this.config.port;
    this.wss = new WebSocketServer({
      port: port
    });
    this.raw = this.config.raw || false
    this.raw_type = this.config.raw_type || undefined

    this.ping_type = this.config.ping_type || "ping"
    this.proxy_login_type = this.config.proxy_login_type || ""
    this.allowed_proxy_servers = this.config.allowed_proxy_servers || []
    this.proxy_servers = {}

    this.log.info(`listening on port: ${port}`);
    this.initialAserAData = null;
    this.connections = {};
    this.wsconnection = {};
    this.connectionsData = {};
    this.connectionct = 0;
    this.maxconnections = 0;
    this.requests = {}
    const _this = this;
    this.wss.broadcast = broadcast.bind(this);
    this.send = send.bind(this);
    this.wss.on("connection", this.connect);
    this.on("data", function (msg: AserAMessage) {
      try {
        _this.handle_message(msg);
      } catch (error) {
        _this.catchError({
          error: error,
          msg: msg
        });
      }
    });
    this.initiated = true;
    this.setStarted();
  }
}

function connect(ws: any) {
  // @ts-ignore
  const stream = this;
  const connId = aId();
  stream.connections[ws] = connId;
  stream.wsconnection[connId] = ws;
  stream.log.info(`connected websockets: ${connId}`);

  stream.connectionct += 1;
  stream.maxconnections = Math.max(stream.connectionct, stream.maxconnections);

  ws.on("message", function incoming(msg: any) {
    let newmsg, reqdata
    if (stream.raw) {
      newmsg = new AserAMessage({
        message_data: {
          type: stream.raw_type,
          creator: stream.stream_id,
          request_data: { conn_id: connId } as RequestData
        },
        identity_data: {},
        payload: msg
      } as AserAMessageDef)
      reqdata = newmsg.get_request_data()
    } else {
      newmsg = new AserAMessage(JSON.parse(msg))
      reqdata = newmsg.get_request_data()
    }
    if (!reqdata.conn_id) {
        reqdata.conn_id = connId
    }
    if (newmsg.type() === stream.proxy_login_type) {
      stream.log.info("proxy-login to server " + reqdata.server)
      if (reqdata && stream.allowed_proxy_servers.includes(reqdata.server) ) {
        stream.proxy_servers[reqdata.server] = connId
        newmsg.message_data.request_data.requestType = "ACK"
      } else {
        newmsg.message_data.request_data.requestType = "ERROR"
      }
      newmsg.message_data.type = "ACK"
      stream.handle_message(newmsg)
      return
    } 
    stream.log.info("type2 " + JSON.stringify(newmsg.message_data))

    if (newmsg.type() === stream.ping_type) {
      newmsg.message_data.type = "ACK"
      stream.handle_message(newmsg)
      return
    }
    if (reqdata.server) {
      if (!stream.proxy_servers[reqdata.server]) {
        newmsg.message_data.type = "ACK"
        newmsg.message_data.request_data.requestType = "ERROR"
        stream.handle_message(newmsg)
        return
      } 
      // 
      if (stream.proxy_servers[reqdata.server] === connId) {
        // this is a server - find client connection and send
        stream.send(reqdata.conn_id, newmsg);
      } else {
        // this is a client - send to server
        stream.send(stream.proxy_servers[reqdata.server], newmsg);
      }
      return      
    }
    stream.requests[newmsg.message_data.request_data.request_id] = reqdata
    stream.outputStream.writeMessage(newmsg);
  });
  ws.on("close", function incoming(code: any, reason: any) {
    // create system message, remove if last connection for user
    stream.log.info("ws closes");
  });
}

function send(connId:string, msg:AserAMessage): void {
  // @ts-ignore
  const stream = this
  if (stream.wsconnection[connId] && stream.wsconnection[connId].readyState === WebSocket.OPEN){
    stream.wsconnection[connId].send(JSON.stringify(msg))
  } else {
    stream.log.error('No connection')
  }

}

function broadcast(data: any): void {
  // @ts-ignore
  const stream = this;

  stream.wss.clients.forEach(function each(client: any) {
    /* global WebSocket */
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

function handle_message(msg: AserAMessage): void {
  // @ts-ignore
  const stream = this;
  // handle ack
  if (msg.type() === 'ACK') {
    let reqdata = stream.requests[msg.get_request_data().request_id] || msg.get_request_data()
    delete stream.requests[reqdata.request_id]
    // write back original request datamsg.get_request_data().conn_id
    msg.message_data.request_data = {
      ...reqdata
    }
    stream.send(reqdata.conn_id, msg)
    return
  } else if (msg.type() === 'BROADCAST') {
      stream.wss.broadcast(msg);
      return
  }

      if (stream.raw) {
        stream.send(msg.get_request_data().conn_id, msg.message_payload())
      } else {
        stream.send(msg.get_request_data().conn_id, msg)
      }
}

export default AserAWebSocketServerLight;
