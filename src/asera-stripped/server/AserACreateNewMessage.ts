// @flow
"use strict";

import { StreamDef } from "./types";
import AserAStream from "./AserAStream";
import AserAMessage from "./AserAMessage";

import { aId as AserAId } from "./AserAHelpers";

class AserACreateNewMessage extends AserAStream {
  handle_message: Function;
  constructor(
    streamDef: StreamDef,
    outputStream: AserAStream,
    motherId: string
  ) {
    super(streamDef, outputStream, motherId);
    this.handle_message = handle_message.bind(this);
    const _this = this;
    this.on("start", function (msg: any) {
      _this.log.info("starting " + _this.streamId);
      _this.startTimers();
    });
    this.initiated = true;

    this.on("data", function (msg: any) {
      _this.handle_message(msg);
    });
  }
}

function handle_message(msg: AserAMessage) {
  // @ts-ignore
  const stream = this;
  stream.outputStream.writeMessage(
    msg.createMessageWithThisAsMother(
      stream.createMessage({
        message_data: {
          type: stream.getMsgTypeStateValue(
            msg.type(),
            "changeMessageType"
          )
        },
        payload: msg.message_payload()
      })
    )
  );
}

export default AserACreateNewMessage;
