import {
  AsyncRequestParameters,
  AsyncResponseParameters,
  AsyncEventData,
  RequestData,
  RequestType
} from "./types";

import AserAStream from "./AserAStream";

import { aId } from "./AserAHelpers";
import { isAsync } from "./AserAHelpers";
import { isAck } from "./AserAHelpers";
import { isResponse } from "./AserAHelpers";
import { isError } from "./AserAHelpers";

// to be put to AseraHelper, bound to this stream
export const asyncEvent = async function ({
  msg,
  type,
  parameters,
  receiveData,
  ackData,
  errorFunction,
  timeout_ms
}: AsyncRequestParameters): Promise<any> {
  // @ts-ignore
  const stream = this as AserAStream;
  let timeout;
  let asyncId: string = "";
  if (!stream.asyncEvents) {
    stream.asyncEvents = {};
  }

  const timeoutFunc = (timeoutId: string) => {
    return () => {
      let req = stream.asyncEvents[timeoutId];

      if (req) {
        clearInterval(req.timeout);
        delete stream.asyncEvents[timeoutId];
        try {
          req.reject("Timeout");
        } catch (error) {
          stream.log.error({
            msg: "Async error handled by error function",
            error: error
          });
        }
      }
      errorFunction({
        msgId: msg ? msg.message_id() : null,
        type: type,
        parameters: parameters,
        request: req,
        reason: "timeout exceeded: ".concat(stream.config.timeout)
      });
    };
  };

  return new Promise((resolve, reject) => {
    asyncId = aId();
    let localMsg = stream.createMessage({
      message_data: {
        message_id: asyncId,
        type: type
      },
      payload: parameters
    });
    let asyncMsg = msg ? msg.createMessageWithThisAsMother(localMsg) : localMsg;
    if (
      !asyncMsg.message_data.previous_type &&
      stream.config.ack_type
    ) {
      asyncMsg.message_data.previous_type =
        stream.config.ack_type;
    }

    asyncMsg.setRequestData(stream, asyncId, RequestType.REQUEST);

    timeout = setInterval(
      timeoutFunc(asyncId),
      timeout_ms ? timeout_ms : stream.config.timeout || 4000
    );
    let request_data: AsyncEventData = {
      status: "waiting",
      parameters: parameters,
      msg: msg ? msg : null,
      timeout: timeout,
      receiveData: receiveData === undefined ? null : receiveData,
      ackData: ackData === undefined ? null : ackData,
      errorFunction: errorFunction,
      resolve: resolve,
      reject: reject
    };
    stream.asyncEvents[asyncId] = request_data;
    stream.outputStream.writeMessage(asyncMsg);
  });
};

export const asyncEventResponse = function ({ msg }: AsyncResponseParameters) {
  // @ts-ignore
  const stream = this;

  const findAsyncEvent = (request_data: RequestData): string | null => {
    if (
      request_data.request_id &&
      stream.asyncEvents &&
      stream.asyncEvents[request_data.request_id]
    )
      return request_data.request_id;
    if (stream.asyncEvents && request_data.request_id_trace) {
      for (var i = 0; i < request_data.request_id_trace.length; i++) {
        if (stream.asyncEvents[request_data.request_id_trace[i]])
          return request_data.request_id_trace[i];
      }
    }
    return null;
  };

  const request_id = findAsyncEvent(msg.message_data
    .request_data as RequestData);
  if (request_id) {
    const deleteAndResolve =
      msg.message_data.request_data &&
      msg.message_data.request_data.requestType &&
      isAsync(msg.message_data.request_data.requestType);
    const asyncEvent = stream.asyncEvents[request_id];
    if (deleteAndResolve) {
      delete stream.asyncEvents[request_id];
      clearInterval(asyncEvent.timeout);
    }

    try {
      if (
        asyncEvent.receiveData &&
        msg.message_data.request_data &&
        msg.message_data.request_data.requestType &&
        isResponse(msg.message_data.request_data.requestType)
      ) {
        asyncEvent.receiveData(msg);
      }
      if (
        asyncEvent.ackData &&
        msg.message_data.request_data &&
        msg.message_data.request_data.requestType &&
        isAck(msg.message_data.request_data.requestType)
      ) {
        asyncEvent.ackData(msg);
      }
      if (
        msg.message_data.request_data &&
        msg.message_data.request_data.requestType &&
        isError(msg.message_data.request_data.requestType)
      ) {
        asyncEvent.errorFunction(msg);
        asyncEvent.reject();
      }
      if (deleteAndResolve) {
        asyncEvent.resolve();
      }
    } catch (e) {
      asyncEvent.reject(e);
    }
  }
};
