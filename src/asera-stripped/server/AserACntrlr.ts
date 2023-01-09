// @flow
"use strict";

import { StreamDef } from "./types";

import AserADispatcher from "./AserADispatcher";

import AserAMessage from "./AserAMessage";

export default class AserACntrlr extends AserADispatcher {
  constructor(
    streamDef: StreamDef,
    outputStream: AserADispatcher,
    motherId: string
  ) {
    super(streamDef, outputStream, motherId);
    this.log.info(
      "All streams belonging to " + streamDef.streamId + " initiated"
    );
    this.initiated = true;
    process.on("SIGINT", () => {
      this.shutDownAll(this);
    });
    process.on("SIGTERM", () => {
      this.shutDownAll(this);
    });
    this.emit(
      "createDocumentation",
      new AserAMessage({
        message_data: {
          message_id: "generate",
          type: "asera.operator.createDocumentation",
          request_data: {}
        },
        identity_data: {
          identity: streamDef.streamConfig.systemIdentifier
        },
        payload: {}
      })
    );
  }
}
