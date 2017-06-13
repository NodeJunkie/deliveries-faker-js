const MIN = 2;
const MAX = 10;

let FakerPlaces = require('./src/faker/Locations');
let FakerOrders = require('./src/faker/Orders');
let FakerIsochrones = require('./src/faker/Isochrones');

let utils = require('./src/lib/utils');

let pouchdb = require('pouchdb');
pouchdb.plugin(require('pouchdb-erase'));

function logAllErrors() {
    console.log(arguments);
}

function init() {
        let db = utils.setDatabase("testing");
        return db.erase()
            .catch(logAllErrors)
            .then(() => {
                    return db.get('_design/extract').catch(function (err) {
                        if (err.name === 'not_found') {
                            return db.put({
                                "_id": "_design/extract",
                                "language": "javascript",
                                "views": {
                                    "Isochrones": {
                                        "map": "function(doc) { if(doc.properties.type === 'isochrone') emit(doc._id, null); };"
                                    },
                                    "Customers": {
                                        "map": "function(doc) { if(doc.properties.type === 'customer') emit(doc._id, null); };"
                                    },
                                    "Drivers": {
                                        "map": "function(doc) { if(doc.properties.type === 'driver') emit(doc._id, null); };"
                                    },
                                    "Restaurants": {
                                        "map": "function(doc) { if(doc.properties.type === 'restaurant') emit(doc._id, null); };"
                                    },
                                    "Orders": {
                                        "map": "function(doc) { if(doc.properties.type === 'order') emit(doc._id, null); };"
                                    },
                                    "Locations": {
                                        "map": "function(doc) { if(doc.geometry.type === 'Point') emit(doc._id, null); };"
                                    }
                                }
                            });
                        } else { // hm, some other error
                            throw err;
                        }
                    }).then(()=>{
                        return new FakerPlaces(MIN, MAX);
                    });




            })

}
function run(){
return init().catch(logAllErrors).then((faker) => {

    return new FakerOrders(2, 10, faker.data.customers, faker.data.restaurants, faker.data.drivers);
}).then((faker) => {
    return new FakerIsochrones(
        faker.data.customers,
        faker.data.restaurants,
        faker.data.drivers,
        faker.data.orders
    );
}).then((faker) => {
    console.log(`Created:
    ${faker.data.customers.length} Customers
    ${faker.data.drivers.length} Drivers
    ${faker.data.restaurants.length} Restaurants
    ${faker.data.orders.length} Orders
    ${faker.data.isochrones.length} Isochrones`);
    // require('./test/Generate_Customer_Features');
    return faker;

});

}
// run();
module.exports = run;