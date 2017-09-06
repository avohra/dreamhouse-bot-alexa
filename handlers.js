"use strict";

let salesforce = require("./salesforce");
let _ = require("underscore");

let verbalizeOpportunites = (opps) => { 
   var text = "";
    opps.forEach(opp => {
        text += `${opp.get("account").Name.replace("&", "&amp;")} for $${opp.get("amount")} assigned to ${opp.get("owner").Name.replace("&", "&amp;")}. <break time="0.5s" /> `;
    });
    return text;
}

let doUntilComplete = (fn, slots, session, response, dialogState) => {
    switch (dialogState) {
        case 'COMPLETED': 
            fn(slots, session, response, dialogState);
            break;
        default:
            response.direct([{
                "type": "Dialog.Delegate"
            }]);
    }

}

let CountDeals = (slots, session, response, dialogState) => {
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

let FindTopDeals = (slots, session, response, dialogState) => {
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

let EmailRep = (slots, session, response, dialogState) => {
    salesforce.findContacts({name: slots.SalesRep.value}).then(contacts => {
        if (contacts && contacts.length)
            response.say(`OK, sending email ${slots.Subject.value} to ${contacts[0].Email} now.`);
        else
            response.say(`Sorry, I didn't find anyone with the name ${slots.SalesRep.value}`);
    }).catch((err) => {
        console.error(err);
        response.say("Oops. Something went wrong");
    });   
    
}
let ImproveConvRate = (slots, session, response, dialogState) => {
    response.say("Not Implemented");
}
let ImproveResRate = (slots, session, response, dialogState) => {
    response.say("Not Implemented");
}
let LaggardRep= (slots, session, response, dialogState) => {
    response.say("Not Implemented");
}
let QuarterlyProgress = (slots, session, response, dialogState) => {
    response.say("Not Implemented");
}
let RequestUpdate = (slots, session, response, dialogState) => {
    salesforce.findContacts({name: slots.RequestSalesRep.value}).then(contacts => {
        if (contacts && contacts.length)
            response.say(`OK, I will send ${contacts[0].Email} an email on your behalf`);
        else
            response.say(`Sorry, I didn't find anyone with the name ${slots.RequestSalesRep.value}`);
    }).catch((err) => {
        console.error(err);
        response.say("Oops. Something went wrong");
    });    
}
let SalesRepProgress = (slots, session, response, dialogState) => {
    response.say("Not Implemented");
}

exports.FindTopDeals = _.wrap(FindTopDeals, doUntilComplete);
exports.CountDeals = _.wrap(CountDeals, doUntilComplete);
exports.EmailRep = _.wrap(EmailRep, doUntilComplete);
exports.ImproveConvRate = _.wrap(ImproveConvRate, doUntilComplete);
exports.ImproveResRate = _.wrap(ImproveResRate, doUntilComplete);
exports.LaggardRep = _.wrap(LaggardRep, doUntilComplete);
exports.QuarterlyProgress = _.wrap(QuarterlyProgress, doUntilComplete);
exports.RequestUpdate = _.wrap(RequestUpdate, doUntilComplete);
exports.SalesRepProgress = _.wrap(SalesRepProgress, doUntilComplete);










