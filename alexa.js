
module.exports = (req, res) => {

    let session = req.body.session,
        intent,
        slots;
    session.attributes = session.attributes || {};

    if (req.body.request.intent) {
        intent = req.body.request.intent.name;
        slots = req.body.request.intent.slots;
    }

    let say = (text, shouldEndSession) => {

        let outputSpeech = {};

        if (text.indexOf("/>") > 0 || text.indexOf("</")) {
            outputSpeech.type = 'SSML';
            outputSpeech.ssml = "<speak>" + text + "</speak>";
        } else {
            outputSpeech.type = 'PlainText';
            outputSpeech.text = text;
        }

        res.json({
            version: req.version,
            sessionAttributes: session.attributes,
            response: {
                outputSpeech: outputSpeech,
                shouldEndSession: shouldEndSession
            }
        });

    };

    let direct = (directives, shouldEndSession) => {
        res.json({
            version: req.version,
            sessionAttributes: session.attributes,
            response: {
                shouldEndSession: shouldEndSession,
                directives: directives
            }
        });
    }

    console.log("Intent:", intent)
    console.log("Slots:", slots)
    console.log("DialoState:", dialogState)

    return {

        type: req.body.request.type,

        intent: intent,

        slots: slots,

        session: session,

        dialogState: req.body.request.dialogState,

        response: {
            say: text => say(text, true),
            ask: text => say(text, false),
            direct: directives => direct(directives, false)
        }

    };

};