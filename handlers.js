"use strict";

let salesforce = require("./salesforce");

exports.FindTopDeals = (slots, session, response) => {
    session.attributes.stage = "ask_region";
    response.ask("For what region? You can say all");
};

exports.AnswerRegion = (slots, session, response) => {
    if (session.attributes.stage === "ask_region") {
        session.attributes.region = slots.Region.value;
        session.attributes.stage = "ask_sort";
        response.ask("How would you like them sorted (by amount or probability to close)?");
    } else {
        console.log(session.attributes.stage);
        response.say("Sorry, I don't understand why you gave me a region"); 
    }
};

exports.AnswerSort = (slots, session, response) => {
    if (session.attributes.stage === "ask_sort") {
        let sort = slots.Sort.value;
        session.attributes.sort = sort;
        salesforce.findTopDeals({region: session.attributes.region, sort: sort })
            .then(properties => {
                if (properties && properties.length>0) {
                    let text = `OK, here are your top 3 deals for ${session.attributes.region}: `;
                    properties.forEach(property => {
                        console.log(property)
                        text += `${property.get("account").Name.replace("&", "&amp;")} for ${property.get("amount")} assigned to ${property.get("owner").Name.replace("&", "&amp;")}. <break time="0.5s" /> `;
                    });
                    response.say(text);
                } else {
                    response.say(`Sorry, I didn't find any open deals`);
                }
            })
            .catch((err) => {
                console.error(err);
                response.say("Oops. Something went wrong");
            });
    } else {
        response.say("Sorry, I didn't understand that");
    }
};

exports.SearchHouses = (slots, session, response) => {
    session.attributes.stage = "ask_city";
    response.ask("OK, in what city?");
};

exports.AnswerCity = (slots, session, response) => {
    if (session.attributes.stage === "ask_city") {
        session.attributes.city = slots.City.value;
        session.attributes.stage = "ask_bedrooms";
        response.ask("How many bedrooms?");
    } else {
        console.log("Still got here");
        console.log(session.attributes.stage);
        response.say("Sorry, I didn't understand that"); 
    }
};

exports.AnswerNumber = (slots, session, response) => {
    if (session.attributes.stage === "ask_bedrooms") {
        session.attributes.bedrooms = slots.NumericAnswer.value;
        session.attributes.stage = "ask_price";
        response.ask("Around what price?");
    } else if (session.attributes.stage === "ask_price") {
        let price = slots.NumericAnswer.value;
        session.attributes.price = price;
        let priceMin = price * 0.8;
        let priceMax = price * 1.2;
        salesforce.findProperties({city: session.attributes.city, bedrooms: session.attributes.bedrooms, priceMin: priceMin, priceMax: priceMax})
            .then(properties => {
                if (properties && properties.length>0) {
                    let text = `OK, here is what I found for ${session.attributes.bedrooms} bedrooms in ${session.attributes.city} around $${price}: `;
                    properties.forEach(property => {
                        text += `${property.get("avohra__Address__c")}, ${property.get("avohra__City__c")}: $${property.get("avohra__Price__c")}. <break time="0.5s" /> `;
                    });
                    response.say(text);
                } else {
                    response.say(`Sorry, I didn't find any ${session.attributes.bedrooms} bedrooms in ${session.attributes.city} around ${price}.`);
                }
            })
            .catch((err) => {
                console.error(err);
                response.say("Oops. Something went wrong");
            });
    } else {
        response.say("Sorry, I didn't understand that");
    }
};

exports.Changes = (slots, session, response) => {
    salesforce.findPriceChanges()
        .then(priceChanges => {
            let text = "OK, here are the recent price changes: ";
            priceChanges.forEach(priceChange => {
                    let property = priceChange.get("Parent");
                    text += `${property.avohra__Address__c}, ${property.avohra__City__c}.<break time="0.2s"/>
                            Price changed from $${priceChange.get("OldValue")} to $${priceChange.get("NewValue")}.<break time="0.5s"/>`;
            });
           response.say(text);
        })
        .catch((err) => {
            console.error(err);
            response.say("Oops. Something went wrong");
        });
};

exports.FindOpportunities = (slots, session, response) => {
    response.direct([{
        "type": "Dialog.ElicitSlot",
        "slotToElicit": "OppRegion"
    }]);
}