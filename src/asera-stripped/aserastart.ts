import * as AserA from "./AserA";
import fs from "fs";
import pckage from "../../package.json";
import config from "./config";


const startapp = () => {
  const log = null;
  const logger = console;

  const appName = config.get("name");
  const appConfig = config.get("aseraconfig");
  const appStreams = config.get("aseraappstreams");
  let startOk = true;
  let appStreamsExport: { BusinessClasses: any };
  let bc: {};

  if (!appName) {
    logger.error("Application name (env variable ASERAAPPL) must be given ");
    startOk = false;
  }

  if (!appConfig) {
    logger.error(
      "Application stream config file (env variable ASERACONFIG) must be given "
    );
    startOk = false;
  }

  if (!appStreams) {
    logger.error(
      "Application stream export file (env variable ASERASTREAMS) must be given "
    );
    startOk = false;
  }

  if (startOk) {
    appStreamsExport = require(appStreams);
    if (!appStreamsExport) {
      logger.error(`Require on ${appStreams} failed`);
      startOk = false;
    } else {
      bc = appStreamsExport.BusinessClasses;
      if (!bc) {
        logger.error(
          `Exported object BusinessClasses not found on ${appStreams}`
        );
        startOk = false;
      }
    }
  }

  if (!startOk) {
    process.exit(12);
  }

  logger.info("ASERA Application : ", appName);
  logger.info("Stream definition file : ", appConfig);
  logger.info("Application Streams : ", appStreams);

  function jsonfile(file: string) {
    return new Promise((resolve, reject) => {
      fs.readFile(file, (err: any, data: any) => {
        if (err) {
          return reject(err);
        }
        resolve(JSON.parse(data.toString()));
      });
    });
  }
  function configurateserver() {
    Promise.all([jsonfile(appConfig)])
      .then(data => {
        AserA.start({
          businessStreams: bc,
          aseraDefinition: data[0],
          serverId: appName,
          version: pckage.version,
          log: logger
        });
      })
      .catch(err => logger.error(err));
  }

  configurateserver();

}
export default startapp