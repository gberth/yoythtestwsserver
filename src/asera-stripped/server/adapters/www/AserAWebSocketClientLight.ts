import { StreamDef } from "../../types";
import AserAStream from "../../AserAStream";
import AserAMessage from "../../AserAMessage";

import { aId } from "../../AserAHelpers";

const WebSocket = require("ws");
const WebSocketServer = WebSocket.Server;

class AserAWebSocketClientLight extends AserAStream {
  handleWsMessage: Function;
  sendbackMessage: Function;
  sendPingOrTryLogin: Function;
  initiateConnection: Function;
  connectionOpen: boolean;
  pingmsg: any;
  constructor(
    streamDef: StreamDef,
    outputStream: AserAStream,
    motherId: string
  ) {
    super(streamDef, outputStream, motherId);
    this.handleWsMessage = handleWsMessage.bind(this);
    this.sendbackMessage = sendbackMessage.bind(this);
    this.sendPingOrTryLogin = sendPingOrTryLogin.bind(this);
    this.initiateConnection = initiateConnection.bind(this);
    this.connectionOpen = false;

    if (this.config.pingmessage) {
      if (!this.config.pingmessage.message_data.creator) {
        this.config.pingmessage.message_data.creator = this.streamIdentifier;
      }

      this.pingmsg = JSON.stringify(this.config.pingmessage);
    }

    const _this = this;

    this.sendPingOrTryLogin();
    this.on("data", function (msg: AserAMessage) {
      try {
        _this.sendbackMessage(msg);
      } catch (error) {
        _this.connectionOpen = false;
      }
    });
    this.on("ping", function () {
      _this.sendPingOrTryLogin();
    });
    this.initiated = true;
    this.setStarted();
  }
}

function initiateConnection(): void {
  // @ts-ignore
  const stream = this;
  try {
    stream.wss = new WebSocket(stream.config.wsadress);
    stream.wss.on("open", () => {
      stream.connectionOpen = true;

      if (stream.config.openmessage) {
        stream.wss.send(JSON.stringify(stream.config.openmessage));
      }
    });
    stream.wss.on("message", (msgin: string) => {
      let msg;

      try {
        console.log('jaaaaaaaaaaa', msgin, stream.pingmessage)
        msg = new AserAMessage(JSON.parse(msgin));
        console.log( msg.message_data.creator, stream.pingmessage.message_data.creator)
        if (msg.type() === "ACK" && msg.message_data.creator === stream.pingmessage.message_data.creator) {
          stream.log.info("ping returned ok")
        } else {
          stream.handleWsMessage(msg);
        } 
      }
      catch (error) {
        stream.catchError({
          error: error,
          msg: msg,
        });        
    }
    });
    stream.wss.on("close", () => {
      stream.log.info("connection closed");
      stream.connectionOpen = false;
    });
    stream.wss.on("error", (err: any) => {
      stream.log.error("ws error");
      stream.log.error(err);
      stream.connectionOpen = false;
    });
    stream.log.info("WS sucessfullyy established");
  } catch (error) {
    stream.connectionOpen = false;
    stream.log.error("WS not established");
    stream.log.error(error);
  }
}

function sendPingOrTryLogin(): void {
  // @ts-ignore
  const stream = this;

  stream.log.info("ping - open? " + stream.connectionOpen.toString());
  stream.log.info("ping - msg " + stream.pingmsg);

  if (stream.connectionOpen) {
    if (stream.pingmsg) {
      try {
        stream.log.info("pinger");
        stream.wss.send(stream.pingmsg);
      } catch (error) {
        stream.log.info("ping message failed");
        stream.connectionOpen = false;
      }
    }
  } else {
    try {
      stream.initiateConnection();
    } catch (error) {
      stream.connectionOpen = false;
    }
  }
}

function handleWsMessage(msg: AserAMessage): void {
  // @ts-ignore
  const stream = this;

  try {
    msg.message_data.request_data.stream_id = stream.streamId
    console.log('wwwwwwwwwwwwwwy')
    console.dir(msg)
    stream.outputStream.writeMessage(msg);
  } catch (error) {
    stream.log.error("WS Client error write");
    stream.log.error(error);
  }
}

function sendbackMessage(msg: AserAMessage): void {
  // @ts-ignore
  const stream = this;
  try {
    if (!stream.connectionOpen) {
      stream.initiateConnection();
    }
    if (stream.connectionOpen) {
      stream.wss.send(JSON.stringify(msg));
    }
  } catch (error) {
    stream.log.error("Ws Client error sendback");
    stream.log.error(error);
  }
}

export default AserAWebSocketClientLight;
