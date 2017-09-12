"use strict";

let salesforce = require("./salesforce"),
    _ = require("underscore"),
    SF_SALES_REP_NAME = process.env.SF_SALES_REP_NAME,
    SF_CURRENT_PERIOD = process.env.SF_CURRENT_PERIOD_NAME;

let getValue = (slot) => {
    if (slot.resolutions) {
        return slot.resolutions.resolutionsPerAuthority[0].values[0].value.id;
    }
    else
        return slot.value
}   

let verbalizeOpportunites = (opps, assignedTo) => { 
    var text = "";
    opps.forEach(opp => {
        text += `For Customer ${opp.get("account").Name}, there is an opportunity worth $${opp.get("amount")}`
        if (assignedTo)
            text += `, assigned to ${opp.get("owner").Name},`;
        text +=` expiring on ${opp.get("ServiceSource1__REN_Earliest_Expiration_Date__c")}, . <break time="0.5s" />`;
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
    var params = { 
        "!salesStage": ['House Account', 'Closed Sale', 'No Service'],
        select: ['Count_Distinct(Owner.Name) repCount']
    };
    if (!isNaN(slots.LessThan.value))
        params.amount = {
            lt: slots.LessThan.value
        }
    if  (!isNaN(slots.GreaterThan.value))
        params.amount = {
            gt: slots.GreaterThan.value
        } 
    if  (!isNaN(slots.GreaterThanOrEqual.value))
        params.amount = { 
            gte: slots.GreaterThanOrEqual.value
        }

    salesforce.aggregateOpportunities(params)
        .then(opps => {
         if (opps && opps.length>0) {
             let text,
                 result = opps[0];
             console.log(result.get('oppCount'));
             text = `There are ${result.get('oppCount')} open opportunties`;
             if (!isNaN(params.amount.lt)) {
                 text += ` below $${params.amount.lt}`;
             } else if (!isNaN(params.amount.gt)) {
                text += ` above $${params.amount.gt}`;
             } else if (!isNaN(params.amount.gte)) {
                text += ` above and inclusive of $${params.amount.gte}`;
             }
             text += `, <break time="0.5s" /> totaling $${result.get('totalAmount')}, <break time="0.5s" /> assigned to ${result.get('repCount')} reps.`;
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
    console.log(slots.OppSort.id, slots.OppSort.resolutions.resolutionsPerAuthority)
    let params = { 
        "!salesStage": ['House Account', 'Closed Sale', 'No Service'],
        region: slots.OppRegion.value,
        sort: {
            field: getValue(slots.OppSort),
            order: "DESC"
        },
        limit: 3
    };
    salesforce.findOpportunities(params)
        .then(opps => {
            if (opps && opps.length>0) {
                let text = `OK, here are your top 3 deals for ${slots.OppRegion.value}: `;
                text += verbalizeOpportunites(opps, true)
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
                field: 'amount',
                order: 'DESC'
            },
            expirationDate: {
                lt: periods[0].get('SSI_ZTH__Period_Start_Date__c')
            }
        };
        salesforce.findOpportunities(params).then(opps => {
            if (opps && opps.length) {
                var text = 'To improve your conversion rate, you should look for upsell and cross sell potential in your open opportunities. <break time="0.5s" /> I recommend you look at these deals specifically <break time="0.5s" />';
                text += verbalizeOpportunites(opps);
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
            expirationDate: {
                lt: periods[0].get('SSI_ZTH__Period_Start_Date__c')
            }, 
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
    salesforce.aggregateTargets({ 
            group: {
                field: 'SSI_ZTH__Sales_Target__r.SSI_ZTH__Employee__r.Name',
                alias: 'employee'
            }, 
            periodStartDate: {
                lte: 'TODAY'
            },
            periodEndDate: {
                gte: 'TODAY'
            }
        }).then(targets => {
        if (targets && targets.length) {
            let sortedReps = {},
                minstart = null,
                maxend = null;
            targets.forEach(function(target) {
                console.log('laggardTarget: ' + JSON.stringify(target));
                let rep = target.get('employee')
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
            salesforce.aggregateOpportunities({ 
                group: {
                    field: 'owner.name'
                }, 
                closeDate: {
                    gte: minstart, 
                    lte: maxend
                },
                salesStage: ['Closed Sale']
            }).then(results => {
                let maxGap = 0,
                    laggard = null;
                if (results && results.length) {
                    console.log('findLaggardClosed: ' + JSON.stringify(results));
                    results.forEach(function(result) {
                        let rep = result.get('name');
                        let closed = result.get('totalAmount');
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
    salesforce.aggregateTargets({ 
            periodStartDate: {
                lte: 'TODAY'
            },
            periodEndDate: {
                gte: 'TODAY'
            }
        })
        .then(results => {
            if (results && results.length>0) {
                let result = results[0];
                console.log('findWeeklyTarget result: ' + JSON.stringify(result));
                let minstart = result.get('minstart');
                let maxend = result.get('maxend');
                let weeklyTarget = result.get('totalamount');
                salesforce.aggregateOpportunities({ 
                    closeDate: {
                        gte: minstart, 
                        lte: maxend
                    },
                    isClosed: true
                    //salesStage: ['Closed Sale'] 
                }).then(closedResults => {
                        if (closedResults && closedResults.length>0) {
                            let closedResult = closedResults[0];
                            let weeklyClosed = closedResult.get('totalamount');
                            // TODO: Replace the period name with current one
                            console.log('findWeeklyClosed result: ' + JSON.stringify(closedResult));
                            salesforce.aggregateTargets({ period: SF_CURRENT_PERIOD })
                                .then(qtResults => {
                                    if (qtResults && qtResults.length>0) {
                                        let qtResult = qtResults[0];
                                        let quarterlyTarget = qtResult.get('totalamount');
                                        let qtrStart = result.get('minstart');
                                        let qtrEnd = result.get('maxend');
                                        console.log('findQuarterlyTarget result: ' + JSON.stringify(qtResult));
                                        salesforce.aggregateOpportunities({ 
                                            closeDate: {
                                                gte: minstart, 
                                                lte: maxend
                                            },
                                            isClosed: true
                                            //salesStage: ['Closed Sale'] 
                                        }).then(qcResults => {
                                                if (qcResults && qcResults.length>0) {
                                                    let qcResult = qcResults[0];
                                                    let quarterlyClosed = qcResult.get('totalamount');
                                                    let weeklyMiss = weeklyTarget - weeklyClosed;
                                                    let quarterlyMiss = quarterlyTarget - quarterlyClosed;
                                                    let text = 'For this week of the quarter, the team is ';
                                                    text += ` $${weeklyMiss} off of the pace and $${quarterlyMiss} `;
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
            resolutionDate: {
                gte: periods[0].get('SSI_ZTH__Period_Start_Date__c'), 
                lte: periods[0].get('SSI_ZTH__Period_End_Date__c')
            },
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
                periodStartDate: {
                    gte: params.resolutionDate.gte
                },
                periodEndDate: {
                    lte: params.resolutionDate.lte
                },
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
let WhatShouldIDo = (slots, session, response, dialogState) => {
    response.say("Stop screwing around and just fucking close it!");
}

let LongRamble = (slots, session, response, dialogState) => {
    response.say("I don't know about that");
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
exports.WhatShouldIDo = WhatShouldIDo;
exports.LongRamble = _.wrap(LongRamble, doUntilComplete);


