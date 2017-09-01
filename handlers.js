"use strict";

let salesforce = require("./salesforce");

var verbalizeOpportunites = (opps) => { 
   var text = "";
    opps.forEach(opp => {
        text += `${opp.get("account").Name.replace("&", "&amp;")} for $${opp.get("amount")} assigned to ${opp.get("owner").Name.replace("&", "&amp;")}. <break time="0.5s" /> `;
    });
    return text;
}

exports.CountDeals = (slots, session, response, dialogState) => {
    if (dialogState == 'COMPLETED') {
        let bottom = slots.Bottom.value;
        salesforce.countOpportunities({bottom: bottom })
            .then(opps => {
             if (opps && opps.length>0) {
                 let text,
                     result = opps[0];
                 console.log(result.get('expr0'));
                 text = `There are ${result.get('expr0')} opportunties`;
                 if (!isNaN(bottom)) {
                     text += ` over $${bottom}`;
                 }
                 text += `, <break time="0.5s" /> totaling ${result.get('expr1')}, <break time="0.5s" /> assigned to ${result.get('expr2')} reps.`;
                 response.say(text);
             } else {
                 response.say(`Sorry, I didn't find any open deals`);
             }
         })
         .catch((err) => {
             console.error(err);
             response.say("Oops. Something went wrong");
         });
    }
    else 
        response.direct([{
            "type": "Dialog.Delegate"
        }]);
}

exports.FindTopDeals = (slots, session, response, dialogState) => {
    if (dialogState == 'COMPLETED')  {
        salesforce.findOpportunities({region: slots.OppRegion.value, sort: slots.OppSort.value })
            .then(opps => {
                if (opps && opps.length>0) {
                    let text = `OK, here are your top 3 deals for ${slots.OppRegion.value}: `;
                    text += verbalizeOpportunites(opps)
                    response.say(text);
                } else {
                    response.say(`Sorry, I didn't find any open deals`);
                }
            })
            .catch((err) => {
                console.error(err);
                response.say("Oops. Something went wrong");
            });      
    }
    else
        response.direct([{
            "type": "Dialog.Delegate"
        }]);
}













