import fiona
import pymongo
import json

with open('../config.json') as f:
    json_data = json.load(f)

client = pymongo.MongoClient(json_data['databaseURL'] + "/?retryWrites=true&w=majority")
db = client[json_data['databaseName']]
addresses = db['vicmap addresses']

addresses.create_index([
    ('address', pymongo.ASCENDING),
    ('location', pymongo.ASCENDING),
    ('pfi', pymongo.ASCENDING)
], unique=True)

addresses.delete_many({})

shape = fiona.open('./data/address.shp')
iterator = iter(shape)

shape = next(iterator)
i = 0

bulk_operation = addresses.initialize_unordered_bulk_op()

while shape != None:
    properties = shape['properties']
    address = properties['EZI_ADD']
    pfi = properties['PFI']
    location = shape['geometry']

    address_data = {
        'address': address,
        'location': location,
        'pfi': pfi
    }

    bulk_operation.insert(address_data)

    if i % 100000 == 0 and i != 0:
        bulk_operation.execute()
        print('Completed ' + str(i) + ' addresses')
        bulk_operation = addresses.initialize_unordered_bulk_op()

    shape = next(iterator)
    i += 1
