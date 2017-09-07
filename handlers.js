"use strict";

let salesforce = require("./salesforce"),
    _ = require("underscore"),
    SF_SALES_REP_NAME = process.env.SF_SALES_REP_NAME,
    SF_CURRENT_PERIOD = process.env.SF_CURRENT_PERIOD_NAME;

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
            response.say(`OK, sending email ${slots.Subject.value} to ${contacts[0].get('FirstName')} now.`);
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
    salesforce.findWeeklyTarget({})
        .then(results => {
            if (results && results.length>0) {
                let result = results[0];
                console.log('findWeeklyTarget result: ' + result);
                let minstart = result.get('minstart');
                let maxend = result.get('maxend');
                let weeklyTarget = result.get('total');
                salesforce.findPeriodClosed({ minstart: minstart, maxend: maxend })
                    .then(closedResults => {
                        if (closedResults && closedResults.length>0) {
                            let closedResult = closedResults[0];
                            let weeklyClosed = closedResult.get('total');
                            salesforce.findQuarterlyTarget({ minstart: minstart, maxend: maxend })
                                .then(qtResults => {
                                    if (qtResults && qtResults.length>0) {
                                        let qtResult = qtResults[0];
                                        let quarterlyTarget = qtResult.get('total');
                                        let qtrStart = result.get('minstart');
                                        let qtrEnd = result.get('maxend');
                                        salesforce.findPeriodClosed({ minstart: qtrStart, maxend: qtrEnd })
                                            .then(qcResults => {
                                                if (qcResults && qcResults.length>0) {
                                                    let qcResult = qcResults[0];
                                                    let quarterlyClosed = qcResults.get('total');
                                                    let weeklyMiss = weeklyTarget - weeklyClosed;
                                                    let quarterlyMiss = quarterlyTarget - quarterlyClosed;
                                                    let text = 'For this week of the quarter, the team is ';
                                                    text += ` ${weeklyMiss} off of the pace and ${quarterlyMiss} `;
                                                    text += ' below the end of quarter target';
                                                    response.say(text);
                                                } else {
                                                    response.say(`Sorry, I couldn't find any closed data`);
                                                }
                                            }).catch((err) => {
                                                console.error(err);
                                                response.say("Oops. Something went wrong");
                                            });
                                        response.say(text);
                                    } else {
                                        response.say(`Sorry, I couldn't find any closed data`);
                                    }
                                }).catch((err) => {
                                    console.error(err);
                                    response.say("Oops. Something went wrong");
                                });
                            response.say(text);
                        } else {
                            response.say(`Sorry, I couldn't find any target data`);
                        }
                    }).catch((err) => {
                        console.error(err);
                        response.say("Oops. Something went wrong");
                    });
                response.say(text);
            } else {
                response.say(`Sorry, I couldn't find any target data`);
            }
        })
        .catch((err) => {
            console.error(err);
            response.say("Oops. Something went wrong");
        });      
}
let RequestUpdate = (slots, session, response, dialogState) => {
    salesforce.findContacts({name: slots.RequestSalesRep.value}).then(contacts => {
        if (contacts && contacts.length)
            response.say(`OK, I will send ${contacts[0].get('FirstName')} an email on your behalf`);
        else
            response.say(`Sorry, I didn't find anyone with the name ${slots.RequestSalesRep.value}`);
    }).catch((err) => {
        console.error(err);
        response.say("Oops. Something went wrong");
    });    
}
let SalesRepProgress = (slots, session, response, dialogState) => {
    salesforce.findPeriod({ period: SF_CURRENT_PERIOD }).then(periods=> {
        let params = { 
            periodStart: periods[0].get('SSI_ZTH__Period_Start_Date__c'), 
            periodEnd: periods[0].get('SSI_ZTH__Period_End_Date__c'), 
            salesRep: SF_SALES_REP_NAME 
        };
        Promise.all([
            salesforce.aggregateOpportunities({ 
                salesRep: SF_SALES_REP_NAME,
                '!salesStage': ['House Account'] 
            }), 
            salesforce.aggregateOpportunities(_.extend({ 
                salesStage: ['Closed Sale']
            }, params)), 
            salesforce.aggregateOpportunities(_.extend({ 
                salesStage: ['Closed Sale', 'No Service']
            }, params)),
            salesforce.aggregateTargets(_.extend({ 
                period: periods[0].get('Name')
            }, params))
        ]).then(values => { 
            let resRate = (values[2][0].get('totalTargetAmount')/values[0][0].get('totalTargetAmount')*100).toFixed(2),
                convRate = (values[1][0].get('totalAmount')/values[1][0].get('totalTargetAmount')*100).toFixed(2),
                gap = values[3][0].get('totalAmount') - values[1][0].get('totalAmount');
                
                if (gap == 0)
                    response.say(`You're OK. Your resolution rate of ${resRate}% and conversion rate of ${convRate}% are both about the same as the team average.`);
                else if (gap < 0)
                    response.say(`You're doing well. You are $${gap} above target for the week and your resolution rate of ${resRate}% and conversion rate of ${convRate}% are both significantly above the team average.`);
                else    
                    response.say(`You are $${gap} below target for the week and your resolution rate of ${resRate}% and conversion rate of ${convRate}% are both significantly below the team average.`);
            
            }).catch((err) => {
                console.error(err);
                response.say("Oops. Something went wrong");
            });     
    });    
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










