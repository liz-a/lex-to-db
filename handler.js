"use strict";
const { searchImages } = require("pixabay-api");
const { AUTH_KEY } = require("./config");
const AWS = require("aws-sdk");
var docClient = new AWS.DynamoDB.DocumentClient();

//puts api request result in DynamoDB and is the closing script for Lex
function close(sessionAttributes, fulfillmentState, message, params) {
  docClient.put(params, function(err, data) {
    if (err) {
      console.error(
        "Unable to add item. Error JSON:",
        JSON.stringify(err, null, 2)
      );
    } else {
      console.log("Added item:", JSON.stringify(data, null, 2));
    }
  });
  return {
    sessionAttributes,
    dialogAction: {
      type: "Close",
      fulfillmentState,
      message
    }
  };
}

// --------------- Functions that control the bot's behavior -----------------------

//handles search query passed in by Lex

function getSearchQuery(intentRequest, callback) {
  const searchQuery = intentRequest.currentIntent.slots.slotOne;
  if (intentRequest.currentIntent.name === "GetSearchQuery") {
    searchImages(AUTH_KEY, searchQuery)
      .then(res => {
        return res.hits
          .map(imgObj => {
            return {
              url: imgObj.largeImageURL,
              favourites: imgObj.favorites,
              tags: imgObj.tags,
              id: imgObj.id
            };
          })
          .sort((a, b) => a.favourites - b.favourites);
      })
      .then(res => {
        var params = {
          TableName: "hi-world", //table name in DynamoDB
          Item: {
            searchQuery: searchQuery, //unique id, can be anything, in this instance, just an arbitrary number
            message: res //pushes the first item in the array of image objects returned from API query
          }
        };
        callback(
          close(
            intentRequest.sessionAttributes,
            "Fulfilled",
            {
              contentType: "PlainText",
              content: `Okay, here's some ${searchQuery}` //What Lex says
            },
            params
          )
        );
      });
  }
}

// --------------- Intents -----------------------

//called when User specifies intent, in this case - 'Hi Ve'
function dispatch(intentRequest, callback) {
  const intentName = intentRequest.currentIntent.name;

  // Dispatch to your skill's intent handlers
  if (intentName === "GetSearchQuery") {
    return getSearchQuery(intentRequest, callback);
  }
  throw new Error(`Intent with name ${intentName} not supported`);
}

// Main Handler Function!!!!!!
module.exports.lexhandler = (event, context, callback) => {
  try {
    dispatch(event, response => callback(null, response));
  } catch (err) {
    callback(err);
  }
};
