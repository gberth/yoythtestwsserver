"use strict";
import { MessageData, Payload, AserAMessageDef, RequestData } from "./types";
import merge from "merge";
import _ from "underscore";

/* eslint-disable no-use-before-define */

import { aId as AserAId } from "./AserAHelpers";

import { ts } from "./AserAHelpers";
import AserAStream from "./AserAStream";

export default class AserAMessage {
  message_data: MessageData;
  identity_data: {
    [key: string]: any;
  };
  payload: Payload;

  static message: (msg_data: {
    [key: string]: string;
  }) => (
      msg_data: {
        [key: string]: any;
      },
      payload: Payload
    ) => AserAMessage;

  constructor(message: AserAMessageDef, overrideMessageType?: string | null) {
    // a message must contain message_data
    if (!message.message_data) {
      console.log(message);
      throw new Error("Asera message not valid" + message.toString());
    }
    this.message_data = Object.assign({}, message.message_data);
    this.identity_data = Object.assign({}, message.identity_data);
    this.message_data.created = this.message_data.created || ts(); // clone ?
    this.payload = message.payload;
    if (this.message_data.message_id !== "generate" && overrideMessageType) {
      this.message_data.type = overrideMessageType;
    }

    if (
      !this.message_data.message_id ||
      this.message_data.message_id === "generate"
    ) {
      this.message_data.message_id = AserAId();
    }
    if (!this.message_data.request_data) {
      this.message_data.request_data = {} as RequestData;
    }
  }

  identity(): string | null {
    return this.identity_data.identity || null;
  }

  owner(): string | null {
    return this.identity_data.aOwner || null;
  }

  message_id(): string | null {
    return this.message_data.message_id || null;
  }

  type(): string {
    return this.message_data.type;
  }

  message_payload(): Payload {
    return this.payload;
  }

  get_request_data(): RequestData {
    return this.message_data.request_data;
  }
  get_request_id(): string | null {
    return this.message_data.request_data ? (this.message_data.request_data.request_id || null) : null;
  }


  get_request_stream(): string {
    if (this.message_data.request_data && this.message_data.request_data.stream_id) {
      return this.message_data.request_data.stream_id;
    } else {
      return 'no_request_stream_id'
    }
  }

  message_payloadElement(element: string): {} | Array<any> | string | null {
    if (_.isObject(this.payload)) {
      return _.propertyOf(this.payload as object)(element);
    }

    return null;
  }

  stringyfy() {
    return JSON.stringify({
      message_data: this.message_data,
      identity_data: this.identity_data,
      payload: this.payload
    });
  }

  // copy message data from this (mother) to input message
  createMessageWithThisAsMother(
    msg: AserAMessage,
    newMsg: boolean = false
  ): AserAMessage {
    msg.message_data.original_message_id = this.message_data.original_message_id
      ? this.message_data.original_message_id
      : this.message_data.message_id;
    msg.message_data.original_type = this.message_data
      .original_type
      ? this.message_data.original_type
      : this.message_data.type;
    msg.message_data.previous_message_id = this.message_data.message_id;
    msg.message_data.previous_type = this.message_data.type;
    if (!newMsg) {
      msg.message_data.request_data = this.message_data.request_data
        ? merge.recursive({}, this.message_data.request_data)
        : {};
    }
    msg.identity_data = this.identity_data;

    return msg;
  }

  keepOldRequestIdAndSetNew(request_id: string, requestType: string): void {
    if (this.message_data.request_data) {
      if (
        this.message_data.request_data.request_id &&
        !this.message_data.request_data.request_id_trace
      ) {
        this.message_data.request_data.request_id_trace = [];
      }

      if (
        this.message_data.request_data.request_id_trace &&
        this.message_data.request_data.request_id
      ) {
        this.message_data.request_data.request_id_trace.push(
          this.message_data.request_data.request_id
        );
      }
    } else
      // @ts-ignore
      this.message_data.request_data = {};

    this.message_data.request_data.request_id = request_id;
    this.message_data.request_data.requestType = requestType;
  }

  setRequestData(stream: AserAStream, request_id: string, requestType: string): void {
    if (!this.message_data.request_data) {
      // @ts-ignore
      this.message_data.request_data = {};
    }
    this.message_data.request_data.stream_id = stream.streamId;
    this.message_data.request_data.request_id = request_id;
    this.message_data.request_data.requestType = requestType;
  }
}

export function message(msg_data: {
  [key: string]: string;
}): (x0: { message_data: any; payload: Payload }) => AserAMessage {
  return function ({ message_data, payload }): AserAMessage {
    return new AserAMessage({
      message_data: merge.recursive(true, message_data, msg_data),
      identity_data: {},
      payload: payload
    });
  };
}
