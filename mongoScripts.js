// USE WITH CAUTION!!!!

//drop the events table
db.events.drop()

//delete invalid voter registrations
db.registrations.deleteMany({ PhoneNumber: null  })

//delete all registrations for all events
db.events.updateMany({}, { $set: { Registrations: [] } })

