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
    let params = { 
        "!salesStage": ['House Account', 'Closed Sale', 'No Service'],
        gtAmount: slots.Bottom.value
    };
    salesforce.aggregateOpportunities(params)
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
    let params = { 
        "!salesStage": ['House Account', 'Closed Sale', 'No Service'],
        region: slots.OppRegion.value,
        sort: {
            field: slots.OppSort.id,
            order: "DESC"
        }
    };
    salesforce.findOpportunities(params)
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
    salesforce.findPeriod({ period: SF_CURRENT_PERIOD }).then(periods=> {
        let params = { 
            "!salesStage": ['House Account', 'Closed Sale', 'No Service'], 
            salesRep: SF_SALES_REP_NAME,
            sort: {
                field: 'account',
                order: 'DESC'
            },
            expirationEnd: periods[0].get('SSI_ZTH__Period_Start_Date__c')
        };
        salesforce.findOpportunities(params).then(opps => {
            if (opps && opps.length) {
                var text = 'To improve your conversion rate, you should look for upsell and cross sell potential in your open opportunities. <break time="0.5s" /> I recommend you look at these deals specifically <break time="0.5s" />';
                opps.forEach(opp => {
                    text += `${opp.get("account").Name.replace("&", "&amp;")} for customer ${opp.get("Account").Name}. <break time="0.5s" /> `;
                });
                response.say(text);
            }   
            else
                response.say(`Sorry, I don't have anything that can help`);
        });
    });
}
let ImproveResRate = (slots, session, response, dialogState) => {
    salesforce.findPeriod({ period: SF_CURRENT_PERIOD }).then(periods=> {
        let params = { 
            expirationEnd: periods[0].get('SSI_ZTH__Period_Start_Date__c'), 
            salesRep: SF_SALES_REP_NAME,
            salesStage: ['Not Contacted']
        };
        salesforce.aggregateOpportunities(params).then(stats => {
            if (stats[0].get('oppCount') > 0)
                response.say(`You have ${stats[0].get('oppCount')} carryover ${stats[0].get('oppCount') > 0 ? "opportunities" : "opportunity"} in the Not Contacted sales stage which represent $${stats[0].get('totalTargetAmount')} of target amount. Resolving the largest of these would be a good start`);
            else
                response.say(`Sorry <break time="0.5s" /> you're screwed asshole`);
        });
    });
}

let LaggardRep= (slots, session, response, dialogState) => {
    // TODO: Change dayInRange back to TODAY
    salesforce.aggregateTargets({ groupByRep: true, dayInRange: '2016-01-06' }).then(targets => {
        if (targets && targets.length) {
            let sortedReps = {},
                minstart = null,
                maxend = null;
            targets.forEach(function(target) {
                let rep = target.get('SSI_ZTH__Sales_Target__r.SSI_ZTH__Employee__r.Name');
                let start = target.get('minstart');
                let end = target.get('maxend');
                if (!minstart || Date(start) < Date(minstart)) {
                    minstart = start;
                }
                if (!maxend || Date(end) < Date(maxend)) {
                    maxend = end;
                }
                sortedReps[rep] = {
                    start: start,
                    end: end,
                    target: target.get('totalAmount')
                };
            });
            salesforce.findPeriodClosed({ groupByRep: true, minstart: minstart, maxend: maxend }).then(results => {
                let maxGap = 0,
                    laggard = null;
                if (results && results.length) {
                    console.log('findLaggardClosed: ' + JSON.stringify(results));
                    results.forEach(function(result) {
                        let rep = result.get('owner.name');
                        let closed = result.get('total');
                        let repTarget = sortedReps[rep];
                        if (!repTarget) return;
                        repTarget.foundClosed = true;
                        repTarget.gap = repTarget.target - closed;
                        if (!laggard || repTarget.gap > maxGap) {
                            laggard = rep;
                            maxGap = repTarget.gap;
                        }
                    });
                }
                
                // Look for reps who closed nothing.
                let targetReps = _.keys(sortedReps);
                targetReps.forEach(function(rep) {
                    let repTarget = sortedReps[rep];
                    if (!repTarget.foundClosed) {
                        repTarget.gap = repTarget.target;
                        if (!laggard || repTarget.gap > maxGap) {
                            laggard = rep;
                            maxGap = repTarget.gap;
                        }
                    }
                });
                response.say(`${laggard} is the furthest from target this week at $${maxGap} below`);
            });
        }
        else
            response.say('Sorry, there were no targets to find the worst performing rep');
    }).catch((err) => {
        console.error(err);
        response.say("Oops. Something went wrong");
    });   
}

let QuarterlyProgress = (slots, session, response, dialogState) => {
    // TODO: Revert dayInRange back to TODAY
    salesforce.aggregateTargets({ dayInRange: '2016-01-06' })
        .then(results => {
            if (results && results.length>0) {
                let result = results[0];
                console.log('findWeeklyTarget result: ' + JSON.stringify(result));
                let minstart = result.get('minstart');
                let maxend = result.get('maxend');
                let weeklyTarget = result.get('totalamount');
                salesforce.findPeriodClosed({ minstart: minstart, maxend: maxend })
                    .then(closedResults => {
                        if (closedResults && closedResults.length>0) {
                            let closedResult = closedResults[0];
                            let weeklyClosed = closedResult.get('total');
                            // TODO: Replace the period name with current one
                            console.log('findWeeklyClosed result: ' + JSON.stringify(closedResult));
                            salesforce.aggregateTargets({ period: '2016-Q1' })
                                .then(qtResults => {
                                    if (qtResults && qtResults.length>0) {
                                        let qtResult = qtResults[0];
                                        let quarterlyTarget = qtResult.get('totalamount');
                                        let qtrStart = result.get('minstart');
                                        let qtrEnd = result.get('maxend');
                                        console.log('findQuarterlyTarget result: ' + JSON.stringify(qtResult));
                                        salesforce.findPeriodClosed({ minstart: qtrStart, maxend: qtrEnd })
                                            .then(qcResults => {
                                                if (qcResults && qcResults.length>0) {
                                                    let qcResult = qcResults[0];
                                                    let quarterlyClosed = qcResult.get('total');
                                                    let weeklyMiss = weeklyTarget - weeklyClosed;
                                                    let quarterlyMiss = quarterlyTarget - quarterlyClosed;
                                                    let text = 'For this week of the quarter, the team is ';
                                                    text += ` ${weeklyMiss} off of the pace and ${quarterlyMiss} `;
                                                    text += ' below the end of quarter target';
                                                    console.log('findQuarterlyClosed result: ' + JSON.stringify(qcResult));
                                                    response.say(text);
                                                } else {
                                                    response.say(`Sorry, I couldn't find any closed data`);
                                                }
                                            });
                                    } else {
                                        response.say(`Sorry, I couldn't find any closed data`);
                                    }
                                });
                        } else {
                            response.say(`Sorry, I couldn't find any target data`);
                        }
                    });
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
            resolutionStart: periods[0].get('SSI_ZTH__Period_Start_Date__c'), 
            resolutionEnd: periods[0].get('SSI_ZTH__Period_End_Date__c'), 
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
                periodStart: params.resolutionStart,
                periodEnd: params.resolutionEnd,
                period: periods[0].get('Name')
            }, params))
        ]).then(values => { 
            let resRate = (values[2][0].get('totalTargetAmount')/values[0][0].get('totalTargetAmount')*100).toFixed(2),
                convRate = (values[1][0].get('totalAmount')/values[1][0].get('totalTargetAmount')*100).toFixed(2),
                gap = values[3][0].get('totalAmount') - values[1][0].get('totalAmount');
                console.log(gap, values[3][0].get('totalAmount'), values[1][0].get('totalAmount'))
                if (gap == 0)
                    response.say(`You're OK. <break time="0.5s" /> Your resolution rate of ${resRate}% and conversion rate of ${convRate}% are both about the same as the team average.`);
                else if (gap < 0)
                    response.say(`You're doing well. <break time="0.5s" /> You are $${Math.abs(gap)} above target for the week and your resolution rate of ${resRate}% and conversion rate of ${convRate}% are both significantly above the team average.`);
                else    
                    response.say(`You are $${Math.abs(gap)} below target for the week. <break time="0.5s" /> Your resolution rate of ${resRate}% and conversion rate of ${convRate}% are both significantly below the team average.`);
            
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










