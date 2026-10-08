# 🍃 MongoDB Database Project

## 📌 Project Overview

This project demonstrates practical usage of **MongoDB**, a popular NoSQL document-oriented database. The project covers fundamental MongoDB concepts including database and collection creation, CRUD operations, querying, filtering, sorting, aggregation, and data management.

The purpose of this project is to build hands-on experience with MongoDB and understand how NoSQL databases can be used to store, manage, and analyze structured and semi-structured data.

---

## 🎯 Project Objectives

- Understand MongoDB and NoSQL database concepts
- Create and manage MongoDB databases
- Create and manage collections
- Insert and retrieve documents
- Perform CRUD operations
- Filter and sort data
- Update and delete documents
- Use MongoDB aggregation pipelines
- Work with indexes
- Perform data analysis using MongoDB queries

---

## 🛠️ Technologies Used

- **MongoDB**
- **MongoDB Compass**
- **MongoDB Shell (mongosh)**
- **NoSQL**
- **JSON / BSON**
- **Git & GitHub**

---

## 📚 MongoDB Concepts Covered

### 1. Database and Collection Management

Creating a database and collection:

```javascript
use mydatabase

db.createCollection("users")
```

View available databases:

```javascript
show dbs
```

View collections:

```javascript
show collections
```

---

### 2. Insert Documents

Insert a single document:

```javascript
db.users.insertOne({
    name: "Prudhvi",
    age: 22,
    city: "Bangalore",
    role: "Data Analyst"
})
```

Insert multiple documents:

```javascript
db.users.insertMany([
    {
        name: "Rahul",
        age: 24,
        city: "Hyderabad",
        role: "Developer"
    },
    {
        name: "Anjali",
        age: 23,
        city: "Chennai",
        role: "Analyst"
    }
])
```

---

### 3. Read Documents

Retrieve all documents:

```javascript
db.users.find()
```

Find a specific document:

```javascript
db.users.find({
    city: "Bangalore"
})
```

---

### 4. Update Documents

Update one document:

```javascript
db.users.updateOne(
    { name: "Prudhvi" },
    { $set: { role: "Data Analyst" } }
)
```

Update multiple documents:

```javascript
db.users.updateMany(
    { city: "Bangalore" },
    { $set: { country: "India" } }
)
```

---

### 5. Delete Documents

Delete one document:

```javascript
db.users.deleteOne({
    name: "Rahul"
})
```

Delete multiple documents:

```javascript
db.users.deleteMany({
    city: "Chennai"
})
```

---

## 🔎 Querying and Filtering

Find users above a specific age:

```javascript
db.users.find({
    age: { $gt: 22 }
})
```

Find users within an age range:

```javascript
db.users.find({
    age: { $gte: 22, $lte: 25 }
})
```

Using multiple conditions:

```javascript
db.users.find({
    city: "Bangalore",
    age: { $gt: 20 }
})
```

---

## 📊 Sorting and Limiting

Sort documents by age:

```javascript
db.users.find().sort({
    age: 1
})
```

Descending order:

```javascript
db.users.find().sort({
    age: -1
})
```

Limit the number of results:

```javascript
db.users.find().limit(5)
```

---

## 📈 Aggregation

MongoDB aggregation can be used to analyze and transform documents.

Example:

```javascript
db.users.aggregate([
    {
        $group: {
            _id: "$city",
            totalUsers: { $sum: 1 }
        }
    }
])
```

Sort aggregation
