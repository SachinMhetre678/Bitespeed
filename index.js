const express = require('express');
const sqlite3 = require('sqlite3');
const app = express();

app.use(express.json());

// making database
const db = new sqlite3.Database('./contacts.db');

// create table
db.run(`CREATE TABLE IF NOT EXISTS Contact (
    id INTEGER PRIMARY KEY,
    phoneNumber TEXT,
    email TEXT,
    linkedId INTEGER,
    linkPrecedence TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    deletedAt TEXT
)`);

app.post('/identify', (req, res) => {
    const email = req.body.email;
    const phoneNumber = req.body.phoneNumber;
    
    // find existing contacts
    db.all("SELECT * FROM Contact WHERE email = ? OR phoneNumber = ?", [email, phoneNumber], (err, rows) => {
        if (err) {
            console.log(err);
            res.status(500).send("error");
            return;
        }
        
        if (rows.length == 0) {
            // no existing contact found, create new one
            const now = new Date().toString();
            db.run("INSERT INTO Contact (phoneNumber, email, linkPrecedence, createdAt, updatedAt) VALUES (?, ?, 'primary', ?, ?)", 
                [phoneNumber, email, now, now], function(err) {
                if (err) {
                    console.log(err);
                    res.status(500).send("error");
                    return;
                }
                
                res.json({
                    contact: {
                        primaryContatctId: this.lastID,
                        emails: email ? [email] : [],
                        phoneNumbers: phoneNumber ? [phoneNumber] : [],
                        secondaryContactIds: []
                    }
                });
            });
        } else {
            // found existing contacts
            let primaryContact;
            let allContacts = [];
            
            // find primary contact
            for (let i = 0; i < rows.length; i++) {
                if (rows[i].linkPrecedence == 'primary') {
                    primaryContact = rows[i];
                    break;
                }
            }
            
            // get all linked contacts
            db.all("SELECT * FROM Contact WHERE linkedId = ? OR id = ?", [primaryContact.id, primaryContact.id], (err, allRows) => {
                if (err) {
                    console.log(err);
                    res.status(500).send("error");
                    return;
                }
                
                // check if we need to add new contact
                let emailExists = false;
                let phoneExists = false;
                
                for (let i = 0; i < allRows.length; i++) {
                    if (allRows[i].email == email) emailExists = true;
                    if (allRows[i].phoneNumber == phoneNumber) phoneExists = true;
                }
                
                if ((email && !emailExists) || (phoneNumber && !phoneExists)) {
                    // create secondary contact
                    const now = new Date().toString();
                    db.run("INSERT INTO Contact (phoneNumber, email, linkedId, linkPrecedence, createdAt, updatedAt) VALUES (?, ?, ?, 'secondary', ?, ?)", 
                        [phoneNumber, email, primaryContact.id, now, now], function(err) {
                        if (err) {
                            console.log(err);
                            res.status(500).send("error");
                            return;
                        }
                        
                        // get updated contacts
                        db.all("SELECT * FROM Contact WHERE linkedId = ? OR id = ?", [primaryContact.id, primaryContact.id], (err, finalRows) => {
                            if (err) {
                                console.log(err);
                                res.status(500).send("error");
                                return;
                            }
                            
                            buildResponse(finalRows, primaryContact, res);
                        });
                    });
                } else {
                    buildResponse(allRows, primaryContact, res);
                }
            });
        }
    });
});

// function to build response
function buildResponse(contacts, primary, res) {
    let emails = [];
    let phones = [];
    let secondaryIds = [];
    
    // add primary first
    if (primary.email) emails.push(primary.email);
    if (primary.phoneNumber) phones.push(primary.phoneNumber);
    
    // add others
    for (let i = 0; i < contacts.length; i++) {
        if (contacts[i].id != primary.id) {
            secondaryIds.push(contacts[i].id);
            if (contacts[i].email && emails.indexOf(contacts[i].email) == -1) {
                emails.push(contacts[i].email);
            }
            if (contacts[i].phoneNumber && phones.indexOf(contacts[i].phoneNumber) == -1) {
                phones.push(contacts[i].phoneNumber);
            }
        }
    }
    
    res.json({
        contact: {
            primaryContatctId: primary.id,
            emails: emails,
            phoneNumbers: phones,
            secondaryContactIds: secondaryIds
        }
    });
}

app.listen(3000, () => {
    console.log('Server started on port 3000');
});