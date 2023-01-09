import { StreamDef } from "./asera-stripped";
import { AserAMessageDef } from "./asera-stripped";
import { AStream, AMessage, AAsync } from "./asera-stripped";

const aCatch = require('./asera-stripped').Helpers.yCatch;
const isAck = require('./asera-stripped').Helpers.isAck;

class ProxyServer extends AStream {
    server_conn_id: string
    requests: { [key: string]: any }
    connections: { [key: string]: any }
    return_type: string
    constructor(streamDef: StreamDef, outputStream: AStream, motherId: string) {
        super(streamDef, outputStream, motherId);
        this.server_conn_id = ''
        this.requests = {}
        this.connections = {}
        this.return_type = this.config.return_type
        const _this = this
        this.on("data", function (msg: AMessage) {
            try {
                _this.handle_message(msg);
            } catch (error) {
                console.dir(error);
            }
        });
    }

    private handle_message(msg: AMessage) {
        const stream = this
        if (msg.message_payload() && (msg.message_payload() as string).substr(0, 150).includes('identity_data":{"identity":"ostadalsveien"}')) {
            stream.server_conn_id = msg.message_data.request_data.conn_id
            return
        }
        let newmsg: any
        let inpmsg = JSON.parse((msg.message_payload() as string))
        let mdata = inpmsg.message_data || inpmsg.messageData
        let iddata = inpmsg.identity_data || inpmsg.identityData
        let mtype = mdata.type || mdata.message_type || mdata.messageType as string

        if (mtype && mtype.startsWith('yoyth.')) {
            newmsg = this.convertmessage(inpmsg)
        }

        if (mtype && mtype === 'ping') {
            if (stream.server_conn_id && stream.server_conn_id !== msg.message_data.request_data.conn_id
                && !stream.connections[msg.message_data.request_data.conn_id] && iddata && iddata.identity
                && iddata.identity === 'yoyth-web') {
                stream.connections[msg.message_data.request_data.conn_id] = true
                newmsg =
                {
                    message_data: {
                        message_type: 'yoyth.db.search',
                        message_id: msg.message_id()
                    },
                    request_data: {
                        request_id: msg.message_id()
                    },
                    payload: { collections: ['yourmaps', 'yourmapnodes', 'yourwalls', 'yourbricks', 'yourdocuments'] }
                }

                newmsg.identity_data = {
                    identity: 'bd6b9d70-8504-11e8-9840-3b77b7062536',
                    yoythInitial: true
                }
            } else {
                return
            }
        }

        newmsg = newmsg || inpmsg

        const request_data = { ...mdata.requestData, ...mdata.request_data, ...newmsg.request_data }
        request_data.request_id = request_data.request_id || mdata.messageId || mdata.message_id

        let to_conn_id
        if (stream.server_conn_id === msg.message_data.request_data.conn_id) {
            // find to conn from request_id
            to_conn_id = stream.requests[request_data.request_id]
            delete stream.requests[request_data.request_id]
        } else {
            // set conn_id for request_id 
            to_conn_id = stream.server_conn_id
            stream.requests[request_data.request_id] = msg.message_data.request_data.conn_id
            newmsg.message_data.request_data = request_data
        }

        // lag ny melding - legg i payload
        const return_msg = {
            message_data: {
                type: stream.return_type,
                message_id: 'generate',
                request_data: {
                    conn_id: to_conn_id
                }
            },
            identity_data: {},
            payload: newmsg
        }
        stream.outputStream.writeMessage(new AMessage(return_msg));



    }
    private convertmessage(msg: any) {
        let newmsg = {
            payload: msg.payload
        } as any
        if (msg.messageData) {
            newmsg.message_data = { ...msg.messageData }
            delete newmsg.message_data.messageId
            delete newmsg.message_data.messageType
            newmsg.message_data.message_id = msg.messageData.messageId
            newmsg.message_data.message_type = msg.messageData.messageType
            newmsg.identity_data = { ...msg.identityData }
        } else if (msg.message_data) {
            newmsg.messageData = { ...msg.message_data }
            delete newmsg.messageData.message_id
            delete newmsg.messageData.message_type
            delete newmsg.messageData.type
            newmsg.messageData.messageId = msg.message_data.message_id
            if (msg.message_data.message_type) {
                newmsg.messageData.messageType = msg.message_data.message_type
            } else {
                newmsg.messageData.messageType = msg.message_data.type

            }
            newmsg.identityData = { ...msg.identity_data }
        }
        return newmsg

    }

}
export default ProxyServer;
