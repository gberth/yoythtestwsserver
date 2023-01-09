import AserAMessage from "./AserAMessage";
import AserAStream from "./AserAStream";

import {
  AserAErrorDef,
  AckParameters,
  SslOptions,
  AserAItem,
  RequestType,
  LOGLEVELS
} from "./types";

import merge from "merge";

import moment from "moment";

import { v4 as uuidv4 } from 'uuid';

import readline from "readline";

import fs from "fs";

import Q from "q";

type LogDirect = {
  info: Function;
  error: Function;
  trace: Function;
  debug: Function;
  warn: Function;
};

var mylog: LogDirect;

const helperConsoleLog = (logtxt: string) => {
  if (mylog) {
    mylog.info(logtxt);
  } else {
    console.log(logtxt);
  }
};

export const setLogOveride = (logDirect: LogDirect) => {
  mylog = logDirect;
};

function promiseWhile(condition: () => boolean, body: any) {
  var done = Q.defer();

  function loop() {
    // When the result of calling `condition` is no longer true, we are
    // done.

    if (!condition()) return done.resolve(); // Use `when`, in case `body` does not return a promise.
    // When it completes loop again otherwise, if it fails, reject the
    // done promise

    Q.when(body(), loop, done.reject);
  } // Start running the loop in the next tick so that this function is
  // completely async. It would be unexpected if `body` was called
  // synchronously the first time.

  Q.nextTick(loop); // The promise

  return done.promise;
}

export const awaitcondition = (
  condtxt: string,
  cond: () => boolean,
  loop: number = 10,
  waitTime: number = 1000,
  quiet?: boolean
) => {
  let index = 1;
  if (!quiet) {
    helperConsoleLog("Await ".concat(condtxt) + "/" + cond());
  }
  return promiseWhile(
    function () {
      return !cond() && index <= loop;
    },
    function () {
      if (!quiet) {
        helperConsoleLog(condtxt + " " + index + "/" + loop);
      }
      index++;
      return Q.delay(waitTime); // arbitrary async
    }
  );
};
const timestamp = (): string => {
  moment.defaultFormat = "YYYY-MM-DDTHH:mm:ss.SSSZ";
  return moment()
    .format()
    .trim();
};

function delayMs(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function keepMessageForRetry(msg: AserAMessage) {
  // @ts-ignore
  const stream = this instanceof AserAStream ? this : null;

  stream.outputStream.writeMessage(
    msg.createMessageWithThisAsMother(
      stream.createMessage({
        message_data: {
          type: stream.config.keepForRetryType
        },
        payload: msg
      })
    )
  );
}

async function waitForFileContent(file: string, errorf: (x0: any) => void) {
  let promise = new Promise((resolve, reject) => {
    fs.readFile(file, (err: any, data: any) => {
      if (err) {
        return reject(err);
      }

      resolve(data.toString());
    });
  });

  try {
    let data: any = await promise;
    helperConsoleLog(data);
    return data.toString();
  } catch (error) {
    errorf(error);
    helperConsoleLog("Wait for file content error");
    helperConsoleLog(error as any);
  }
}

async function waitForListDirectory(
  searchfor: string,
  file: string,
  errf: string
) {
  let promise = new Promise((resolve, reject) => {
    fs.readdir(searchfor, (err: any, filenames: Array<string>) => {
      if (err) {
        reject(err);
      } else {
        let ret = <any>[];
        filenames.forEach(filename => {
          if (filename.startsWith(file)) {
            ret.push(filename);
          }
        });
        resolve(ret);
      }
    });
  });

  try {
    let list = await promise;
    return list;
  } catch (error) {
    return [];
  }
}
export const readCertificates = (ssl: SslOptions): SslOptions => {
  let retSsl = <SslOptions>Object.assign({}, ssl);

  if (ssl.ca) {
    retSsl.ca = fs
      .readFileSync(process.env[ssl.ca] || ssl.ca)
      .toString("utf-8");
  }
  if (ssl.key) {
    retSsl.key = fs
      .readFileSync(process.env[ssl.key] || ssl.key)
      .toString("utf-8");
  }
  if (ssl.cert) {
    retSsl.cert = fs
      .readFileSync(process.env[ssl.cert] || ssl.cert)
      .toString("utf-8");
  }
  return retSsl;
};

export const aId = (): string => {
  return uuidv4().toString();
};

const log = (
  stream: AserAStream,
  logItem: any,
  logLevel: number | undefined = LOGLEVELS.info
): void => {
  if (stream && logLevel < stream.getLog() && !stream.log_to_console) {
    return;
  }
  let logtxt = (stream ? stream.streamIdentifier : "nostream") + " : ";
  if (logItem.msg) {
    logtxt += logItem.msg;
    delete logItem.msg;
    logtxt += JSON.stringify(logItem).substring(0, 1000);
  } else {
    logtxt +=
      " " + (typeof logItem === "string" || logItem instanceof String)
        ? logItem
        : "";
  }
  if (stream.log_to_console) {
    console.log(logtxt)
  }

  //TODO if less than info - log stream state maybe
  if (mylog) {
    switch (logLevel) {
      case LOGLEVELS.error:
        mylog.error(logtxt);
        break;
      case LOGLEVELS.warn:
        mylog.warn(logtxt);
        break;
      case LOGLEVELS.info:
        mylog.info(logtxt);
        break;
      case LOGLEVELS.debug:
        mylog.debug(logtxt);
        break;
      case LOGLEVELS.trace:
        mylog.trace(logtxt);
        break;
      default:
        mylog.error("Wrong message type for logging" + JSON.stringify(logtxt));
        break;
    }
    return;
  }

  let logObject = {
    log_ts: ts(),
    stream: stream ? stream.streamIdentifier : "nostream",
    log: logItem,
    logLevel: logLevel
  };

  if (stream && stream.outputStream && stream.streamId !== "aseraLog") {
    stream.outputStream.writeMessage(
      stream.createMessage({
        message_data: {
          type: "asera.log"
        },
        payload: logObject
      })
    );
  } else {
    console.log(logtxt);
    // nothing todo - log event also logs - nop
  }
};

export const aseraLogger = {
  info: function (this: AserAStream, logItem: any) {
    log(this, logItem);
  },
  warn: function (this: AserAStream, logItem: any) {
    log(this, logItem, LOGLEVELS.warn);
  },
  error: function (this: AserAStream, logItem: any) {
    log(this, logItem, LOGLEVELS.error);
  },
  trace: function (this: AserAStream, logItem: any) {
    log(this, logItem, LOGLEVELS.trace);
  },
  debug: function (this: AserAStream, logItem: any) {
    log(this, logItem, LOGLEVELS.debug);
  }
};

export const createAck = function ({
  msg,
  type,
  response,
  payload,
  error = false
}: AckParameters) {
  // @ts-ignore
  // deprectaed
  const stream = this instanceof AserAStream ? this : null;
  if (!stream) return null;
  let newmsgt;
  if (type) {
    newmsgt = type;
  } else {
    newmsgt = msg.message_data.previous_type
      ? msg.message_data.previous_type.concat(".ack")
      : stream.config.ack && stream.config.ack.type
        ? stream.config.ack.type
        : "unknown";
  }

  let ack = msg.createMessageWithThisAsMother(
    stream.createMessage({
      message_data: {
        type: newmsgt
      },
      payload: response && payload ? payload : {}
    })
  );

  // don't understand
  ack.message_data.request_data = merge.recursive(
    true,
    {},
    ack.message_data.request_data ? ack.message_data.request_data : {}
  );

  // @ts-ignore
  ack.message_data.request_data.requestType = response
    ? RequestType.RESPONSE_WITH_ACK
    : RequestType.ACK;
  // @ts-ignore
  ack.message_data.request_data.who = stream.streamIdentifier;
  // @ts-ignore
  ack.message_data.request_data.ts = ts();

  if (error) {
    // @ts-ignore
    ack.message_data.request_data.requestType = RequestType.ERROR;
  }
  stream.outputStream.writeMessage(ack);
};
export const ack = function ({
  msg,
  response,
  payload, 
  error = false
}: AckParameters) {
  // @ts-ignore
  const stream = this instanceof AserAStream ? this : null;
  if (!stream) return null;

  let newmsg = msg.createMessageWithThisAsMother(
    stream.createMessage({
      message_data: {
        type: RequestType.ACK
      },
      payload: payload || {}
    })
  );

  // @ts-ignore
  newmsg.message_data.request_data.requestType = response
    ? RequestType.RESPONSE_WITH_ACK
    : RequestType.ACK;
  // @ts-ignore
  newmsg.message_data.request_data.ts = ts();

  if (error) {
    // @ts-ignore
    newmsg.message_data.request_data.requestType = RequestType.ERROR;
  }
  stream.outputStream.writeMessage(newmsg);
};

export const isAck = (type: string | undefined): boolean => {
  return (
    typeof type !== "undefined" &&
    (type === RequestType.RESPONSE_WITH_ACK ||
      type === RequestType.ACK ||
      type === RequestType.ERROR)
  );
};
export const isResponse = (type: string | undefined): boolean => {
  return (
    typeof type !== "undefined" &&
    (type === RequestType.RESPONSE_WITH_ACK || type === RequestType.RESPONSE)
  );
};
export const isError = (type: string): boolean => {
  return typeof type !== "undefined" && type === RequestType.ERROR;
};

export const isAsync = (type: string): boolean => {
  return (
    typeof type !== "undefined" &&
    (type === RequestType.ERROR ||
      type === RequestType.RESPONSE_WITH_ACK ||
      type === RequestType.RESPONSE ||
      type === RequestType.ACK)
  );
};

export const delay = async (ms: number) => {
  await delayMs(ms);
};
export const returnFileContent = async (
  file: string,
  errf: (x0: any) => void
) => {
  let xx = await waitForFileContent(file, errf);
  return xx;
};
export const listDirectory = async (
  directory: string,
  file: string,
  errf: string
) => {
  let xx = await waitForListDirectory(directory, file, errf);
  return xx;
};
export const ts = (): string => {
  return timestamp();
};
export const aItem = ({
  itemType,
  id,
  payload,
  version,
  owner
}: {
  itemType: string;
  id: string;
  payload: {};
  version?: number;
  owner?: string;
}): AserAItem => {
  let item = {
    aItem: {
      aMetaData: {
        aId: id || uuidv4().toString(),
        aType: itemType,
        aOwner: owner || ""
      },
      aContent: {
        ...payload
      }
    }
  };

  if (version) {
    // @ts-ignore
    item.aItem.aMetaData.aVersion = version;
  }

  return item;
};
export const keepForRetry = function (msg: AserAMessage): void {
  // create a message with msg as payload, with type= this.config.keepForRetryType
  // @ts-ignore
  const stream = this instanceof AserAStream ? this : null;
  if (stream && stream.config.keepForRetryType) {
    keepMessageForRetry.bind(stream)(msg);
  }
};
export const yCatch = function (errorParm: AserAErrorDef): void {
  // @ts-ignore
  const stream = this instanceof AserAStream ? this : null;

  helperConsoleLog(
    "error occured " + (stream ? stream.streamIdentifier : "nostream")
  );

  if (stream && stream.config && stream.config.console) {
    const readLine = (lineHandler: any, resolve: any, reject: any) => {
      readline
        .createInterface({
          input: process.stdin,
          output: process.stdout
        })
        .on("line", function (line: string) {
          if (line === "") {
            resolve(true);
          } else {
            lineHandler(line);
          }
        });
    };

    // @ts-ignore
    const rl = readLine.bind(this);

    const evaluateError = (evaluate: string) => {
      helperConsoleLog(
        `Evaluate result: ${evaluate} = ${global.eval(evaluate)}`
      );
    };

    // @ts-ignore
    const evaluateErr = evaluateError.bind(this);

    new Promise((resolve, reject) => {
      rl(evaluateErr, resolve, reject);
    }).then(() => {
      helperConsoleLog("Good bye");
      process.exit(12);
    });
  }

  if (
    (stream && stream.config.exitOnError) ||
    (errorParm.msg &&
      errorParm.msg instanceof AserAMessage &&
      errorParm.msg.type() === "asera.critical.error")
  ) {
    helperConsoleLog("Abort as last resort");
    process.exit(12);
  }

  //if (errorParm.msg && JSON.stringify(errorParm.msg.payload).length > 1000) {
  //errorParm.msg.payload = JSON.stringify(errorParm.msg.payload).substring(0,1000)
  //}
  let payload = {
    error: errorParm.error,
    stack: errorParm.error.stack,
    msg: errorParm.msg || null,
    extra: errorParm.rest || null,
    loglevel: LOGLEVELS.error
  };

  if (stream && stream.outputStream && !mylog) {
    stream ? (stream.config.inError = true) : helperConsoleLog("nostream");

    let newmsg = stream.createMessage({
      message_data: {
        type: "asera.error"
      },
      payload: payload
    });

    stream.outputStream.writeMessage(
      errorParm.msg && errorParm.msg instanceof AserAMessage
        ? errorParm.msg.createMessageWithThisAsMother(newmsg)
        : newmsg
    );

    if (stream && stream.config.onErrorType) {
      let newmsg = stream.createMessage({
        message_data: {
          type: stream.config.onErrorType
        },
        payload: payload
      });
      stream.outputStream.writeMessage(
        errorParm.msg && errorParm.msg instanceof AserAMessage
          ? errorParm.msg.createMessageWithThisAsMother(newmsg)
          : newmsg
      );
    } // if this.keepForResend - create a retryMessage
  } else if (stream && mylog) {
    log(stream, payload.error, LOGLEVELS.error);
    log(stream, payload, LOGLEVELS.error);
  } else {
    console.dir(payload);
  }
};