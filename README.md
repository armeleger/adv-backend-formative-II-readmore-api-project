# ReadMore API — Express + MongoDB (Mongoose)

A REST API for the ReadMore bookstore. It manages **Authors** and **Books**, where every book belongs to exactly one author, and it enforces the store's business rules in the controllers.

## Tech stack

- **Node.js** + **Express 5**
- **MongoDB** with **Mongoose** (models, references, `populate`)
- **dotenv** for configuration, **nodemon** for development

## Getting started

```bash
npm install
# create a .env file in the project root (see the table below), e.g.:
#   PORT=3000
#   MONGO_URI=mongodb://127.0.0.1:27017/readmore
npm run seed              # optional: load sample authors and books (wipes existing data)
npm run dev               # or: npm start
```

The server connects to MongoDB first and only starts listening (default `http://localhost:3000`) once the connection has succeeded.

| Variable    | Description                          | Example                                  |
|-------------|--------------------------------------|------------------------------------------|
| `PORT`      | Port the API listens on              | `3000`                                   |
| `MONGO_URI` | MongoDB connection string            | `mongodb://127.0.0.1:27017/readmore`     |

`requests.http` contains a ready-made request for every endpoint and business rule (VS Code **REST Client** extension).

## Project structure

```
├── server.js              entry point: load .env, connect to MongoDB, then listen
├── app.js                 Express app: JSON body parsing, routes, error handling
├── config/db.js           Mongoose connection
├── models/
│   ├── Author.js          name (required), country, bio
│   └── Book.js            title, genre, price, publishedYear (all required), author → Author
├── controllers/
│   ├── authorController.js
│   └── bookController.js  business rules, dynamic filter builder, pagination
├── routes/
│   ├── authorRoutes.js    URL → controller wiring only
│   └── bookRoutes.js
├── middleware/
│   ├── errorHandler.js    404 fallback + central error → status-code mapping
│   └── validateObjectId.js
├── utils/pick.js          whitelist request-body fields
└── scripts/seed.js        sample data
```

Routes only map URLs to controller functions. All the logic (reading the request, applying rules, querying the database, choosing the status code) lives in the controllers. Express 5 passes errors from async handlers to the central error handler automatically, so controllers don't repeat `try/catch` blocks.

## Data model

```
authors ──< books
```

`Book.author` is an `ObjectId` with `ref: 'Author'`. Reads of books use `.populate('author', 'name country bio')`, so the full author details appear instead of a bare id.

## Endpoints

### Authors

| Method   | Path                   | Description                                  |
|----------|------------------------|----------------------------------------------|
| `POST`   | `/authors`             | Create an author                             |
| `GET`    | `/authors`             | List all authors (sorted by name)            |
| `GET`    | `/authors/:id`         | Get one author                               |
| `PUT`    | `/authors/:id`         | Update an author                             |
| `DELETE` | `/authors/:id`         | Delete an author (blocked if they have books)|
| `GET`    | `/authors/:id/books`   | All books by that author                     |
| `GET`    | `/authors/:id/stats`   | Book count, average price, cheapest/most expensive |

### Books

| Method   | Path          | Description                                        |
|----------|---------------|----------------------------------------------------|
| `POST`   | `/books`      | Create a book for an existing author               |
| `GET`    | `/books`      | List books: filter, sort and paginate (author populated) |
| `GET`    | `/books/:id`  | Get one book (author populated)                    |
| `PUT`    | `/books/:id`  | Update a book                                      |
| `DELETE` | `/books/:id`  | Delete a book                                      |

`GET /` is a health check.

### Status codes

| Code  | When                                                                     |
|-------|--------------------------------------------------------------------------|
| `200` | Successful read / update / delete                                        |
| `201` | Created                                                                  |
| `400` | Missing required fields, wrong types, invalid JSON, orphan author id, bad query parameter |
| `404` | No author/book with that id (including malformed ids), unknown route     |
| `409` | Duplicate title for the same author, or deleting an author who still has books |
| `422` | Price ≤ 0, or `publishedYear` not a whole year between 1450 and the current year |

## Business rules (Part 4)

All book rules run in one place (`checkBookRules` in `bookController.js`) against the book **as it would be saved**. Create and update therefore share exactly the same checks, and an update is validated together with the book's existing values.

### 1. No orphan books (400)
`required: true` only checks that *some* value was sent. Mongoose doesn't check that an Author with that id actually exists, and MongoDB has no foreign keys. So before saving, the controller runs `Author.exists({ _id })` and rejects with **400** if it fails. An id that isn't a valid ObjectId at all is also rejected with **400**.

### 2. No duplicate titles per author (409)
The controller looks up a book with the **same author** and the same title, using a case-insensitive collation (`{ locale: 'en', strength: 2 }`), so `"the silent sea"` matches `"The Silent Sea"`. Titles are trimmed first. The query is scoped to the author, so two different authors may each have a book called "Home". On update, the book being edited is excluded so it never clashes with itself.

A unique compound index on `{ author, title }` with the same collation backs this up. If two identical requests arrive at the same instant and both pass the check, the database still rejects the second one, and the error handler turns that into **409**.

### 3. Values the schema can't express (422)
`price` must be greater than 0. `publishedYear` must be a whole number from 1450 (the printing press) to the **current** year. "The current year" changes over time, which is why this lives in code rather than as a fixed schema `max`. These rules check data that is well-formed but not allowed, so they return **422**. Wrong types (e.g. `"price": "abc"`) are a malformed request and return **400**.

### 4. Deleting an author who still has books: **Option A, Block (409)**
`DELETE /authors/:id` returns **409** if the author still has books, along with the list of those books so the client knows what to delete or reassign first.

**Why block?**
- A real bookstore's catalogue is linked to orders, invoices, reviews and stock. **Cascade** would silently wipe records of books that may already have been sold. Once books have sold, losing them means losing business history.
- **Reassign** keeps the books but credits them to someone who didn't write them, which is misleading to customers and wrong for royalties and copyright.
- **Block** never loses or falsifies data. It makes the destructive decision explicit, leaves it to a human, and is easy to change later (cascade or reassign can be added as a deliberate admin action).

**Downside:** removing an author takes extra work. Every one of their books has to be deleted or moved first, which is tedious for a prolific author, and the author record stays until that's done.

### 5. Search & filter on `GET /books`
All parameters are optional and can be combined freely:

| Param                  | Effect                                                             |
|------------------------|--------------------------------------------------------------------|
| `genre`                | exact genre, case-insensitive                                      |
| `minPrice`, `maxPrice` | price range: either one, both, or neither                          |
| `author`               | books by that author id                                            |
| `search`               | title contains the text (case-insensitive; special characters matched literally) |
| `sort` + `order`       | `price`, `title` or `publishedYear`; `asc` (default) or `desc`     |
| `page` + `limit`       | pagination (see below)                                             |

The query is **built dynamically**. `buildBookQuery` starts from an empty filter `{}`, and each parameter that is present adds its own piece:

```
?genre=Thriller            → { genre: 'Thriller' }
?minPrice=10               → { price: { $gte: 10 } }
?minPrice=10&maxPrice=30   → { price: { $gte: 10, $lte: 30 } }
(no parameters)            → {}   (every book)
```

Invalid values (a non-numeric price, `minPrice > maxPrice`, an unknown sort field, a bad order, a malformed author id, or a parameter given twice) are rejected with **400** and a message. Unknown parameters are ignored. `_id` is always used as a final tie-breaker, so the order is stable across pages.

### 6. Author statistics
`GET /authors/:id/stats`

```json
{
  "author": "Chinua Achebe",
  "bookCount": 4,
  "averagePrice": 21.5,
  "cheapestBook": "Things Fall Apart",
  "mostExpensiveBook": "Anthills of the Savannah"
}
```

The average is rounded to 2 decimal places. **No books:** `bookCount` is `0`, while `averagePrice`, `cheapestBook` and `mostExpensiveBook` are `null` and a `message` explains why. `null` means "doesn't apply", whereas an average of `0` would wrongly suggest free books. The response shape is the same either way, so clients don't break. Unknown author ids return **404**.

### Challenge: pagination
`GET /books` always responds with:

```json
{ "page": 2, "limit": 3, "total": 10, "totalPages": 4, "results": [ ... ] }
```

- No `page`/`limit` → every matching book (`limit: null`), as the "no params returns everything" rule requires.
- `page` only → 10 per page. `limit` only → page 1. `limit` is capped at 100.
- `total` counts all books matching the filters, not just the current page.
- `page`/`limit` must be whole numbers ≥ 1 (otherwise **400**). A page past the end returns an empty `results` array.

---

<details>
<summary>Original assignment brief</summary>

# ReadMore API — Express + MongoDB (Mongoose)

Your first backend API assignment. Build a small REST API for a bookstore using **Express.js**, with **MongoDB** as the database and **Mongoose** as the modelling layer.

There are **two entities** — **Author** and **Book** — and they are **linked**: one author can have many books, and every book belongs to one author. You will model them, connect to MongoDB, and build endpoints for each.

Then, in **Part 4**, the store "goes live" and your endpoints have to enforce **real business rules** the database won't enforce on its own. That part is where the marks are — it rewards how you *think*, not just whether the CRUD works.

> **Before you start:** watch the Mongoose video shared with this assignment. It covers connecting to MongoDB, defining schemas and models, and the basic query methods you will need. This is a take-home assignment — you are expected to work out the *how* yourself.

---

## What you need

- **Node.js 18+** and **npm**
- **MongoDB** — either a local install or a free **MongoDB Atlas** cluster
- An API client to test your endpoints: **Postman**, **Insomnia**, or the VS Code **REST Client** extension
- Suggested packages: `express`, `mongoose`, `dotenv` (and `nodemon` for development)

---

## The data model

```
authors ──< books
```

One author has **many** books; each book belongs to **one** author. The link is a field on the book that stores the author's id.

| Entity  | Fields                                                              |
|---------|--------------------------------------------------------------------|
| Author  | `name`, `country`, `bio`                                           |
| Book    | `title`, `genre`, `price`, `publishedYear`, `author` (→ Author id) |

---

## Suggested project structure

Keep the code organised. A route should only map a URL to a function; the **controller** is the function that does the actual work — reading the request, applying the rules, talking to the database, and choosing the response and status code. Keeping them apart is where most of the marks live: your routes will be short, your controllers will have to *think*.

```
readmore-api/
├── .env             ← your MongoDB connection string (do NOT commit real secrets)
├── .gitignore       ← ignore node_modules and .env
├── server.js        ← app entry point: connect to DB + start the server
├── models/          ← Author and Book schemas
├── controllers/     ← the logic lives here
└── routes/          ← wire URLs to controller functions
```

---

## Part 0 — Project setup

Get a server running and connected to MongoDB before you build anything else.

- Initialise the project and install your dependencies.
- Store your MongoDB connection string in a `.env` file (never hard-code it).
- Connect to MongoDB on startup and only start listening once the connection succeeds.
- Add a health-check route (`GET /`) that returns a simple JSON message.

---

## Part 1 — Define the two models

> **Concept:** a Mongoose **schema** describes the shape of a document; a **model** is what you use to read and write those documents. The link between two collections is made with a field of type `ObjectId` that **references** the other model — this is what later lets you `populate` the author's full details onto a book.

- Create the **Author** model with the fields listed above.
- Create the **Book** model, including the `author` field that references the Author model. This reference is what links the two entities.
- Decide which fields should be **required**.

---

## Part 2 — Author endpoints

Build these five endpoints for the **Author** entity, mounted under `/authors`.

| # | Method   | Path            | What it does              |
|---|----------|-----------------|---------------------------|
| 1 | `POST`   | `/authors`      | Create a new author       |
| 2 | `GET`    | `/authors`      | Get **all** authors       |
| 3 | `GET`    | `/authors/:id`  | Get **one** author by id  |
| 4 | `PUT`    | `/authors/:id`  | Update an author          |
| 5 | `DELETE` | `/authors/:id`  | Delete an author          |

Put the logic in a controller; keep the route file to wiring only. For read-one, update, and delete, return **404** with a helpful message when no author has that id.

---

## Part 3 — Book endpoints (the linked entity)

Build the same five endpoints for the **Book** entity, mounted under `/books`.

| # | Method   | Path          | What it does                    |
|---|----------|---------------|---------------------------------|
| 1 | `POST`   | `/books`      | Create a book **for an author** |
| 2 | `GET`    | `/books`      | Get all books                   |
| 3 | `GET`    | `/books/:id`  | Get one book by id              |
| 4 | `PUT`    | `/books/:id`  | Update a book                   |
| 5 | `DELETE` | `/books/:id`  | Delete a book                   |

When you create a book, the request body must include the id of an author that already exists:

```json
{
  "title": "The Silent Sea",
  "genre": "Thriller",
  "price": 24.99,
  "publishedYear": 2021,
  "author": "<an existing author id>"
}
```

### Requirements
- **Show the link.** On `GET /books` and `GET /books/:id`, the author should appear as the **full author details**, not just an id. (Mongoose has a feature for this — find it in the video.)
- Return **404** when a book id is not found.
- **Add one linking endpoint:** `GET /authors/:id/books` — return all books written by that author.

---

## Part 4 — The Scenario: ReadMore goes live

> **This is the part that tests your thinking.** So far your controllers just move data in and out. Now the store is opening to real customers, and the product owner hands you rules the API must enforce. **MongoDB will not enforce these for you** — your controllers have to. Some have an obvious solution; at least one has *no single right answer*, and you must choose an approach and defend it.

Read all six requirements before writing code — some affect each other.

### 1 — No orphan books
A book must belong to a **real** author. If someone tries to create a book with an author id that doesn't exist, reject it with **400** and don't save it.
> The Book schema already marks `author` as required. Why is that *not enough* to stop a made-up id?

### 2 — No duplicate titles per author
The same author may not have two books with the **same title**, treated case-insensitively (`"the silent sea"` = `"The Silent Sea"`). Reject a duplicate with **409**.
> This rule is per-author, not global — two *different* authors may each write a book called "Home". Your check has to reflect that.

### 3 — Rules the schema can't express
Reject with **422** and a helpful message if `price` is zero or negative, or if `publishedYear` is in the future or before 1450.

### 4 — Deleting an author who still has books *(the hard one)*
Deleting an author currently leaves their books pointing at an id that no longer exists (**orphans**). Fix this. Three reasonable policies exist:

| Option | Behaviour                                                                   |
|--------|-----------------------------------------------------------------------------|
| **A**  | **Block** the delete — return **409** if the author still has books.         |
| **B**  | **Cascade** — delete the author *and* all of their books.                   |
| **C**  | **Reassign** — move the books to a fallback author before deleting.         |

**Pick ONE, implement it, and justify it out loud in your video:** why you chose it and what its downside is — every option has one.
> What would a real bookstore want? Does your answer change if the books have already been sold?

### 5 — A search & filter endpoint
Upgrade `GET /books` to accept these **optional** query parameters, in any combination:

```
GET /books?genre=Thriller&minPrice=10&maxPrice=30&search=sea&sort=price&order=asc
```

| Param                 | Effect                                                          |
|-----------------------|----------------------------------------------------------------|
| `genre`               | only books of that genre                                       |
| `minPrice`/`maxPrice` | price within the range (either, both, or neither may appear)   |
| `author`              | only books by that author id                                   |
| `search`              | title contains this text (case-insensitive)                    |
| `sort` + `order`      | sort by `price`, `title`, or `publishedYear`, ascending/descending |

The catch: **only the parameters actually present should be applied.** If the client sends none, return everything. You must build the query **dynamically** — do not write a separate hard-coded query for every combination.
> What does your filter look like with only `genre`? Only `minPrice`? Both prices? Sketch it before coding.

### 6 — Author statistics
Add `GET /authors/:id/stats` returning a summary computed from that author's books:

```json
{
  "author": "Chinua Achebe",
  "bookCount": 4,
  "averagePrice": 21.5,
  "cheapestBook": "Things Fall Apart",
  "mostExpensiveBook": "Anthills of the Savannah"
}
```

If the author has **no books**, return sensible values instead of crashing — decide what "sensible" means.

**Challenge:** add **pagination** to `GET /books` (`page` and `limit` params) and include `page`, `limit`, `total`, and the `results` in the response.

---

## What to submit


Submit a **a Github repository link** containing your project code. The repository must also contain **a video recording** in which you walk through your entire implementation. Your video should:

- Show the code for your models, controllers, and routes, explaining what each part does.
- Run the server and demonstrate **every endpoint** live in your API client (Postman/Insomnia/REST Client).
- Demonstrate each **Part 4** business rule working — the rejected orphan (400), the rejected duplicate (409), the rejected invalid price/year (422), your author-delete policy, `GET /books` with **at least two filters combined**, and `GET /authors/:id/stats`.
- **Explain your reasoning out loud**, especially your choice of author-delete policy (Requirement 4) and its downside.

> I will be grading how you *think*, so narrate your decisions — don't just click through.

Good luck — build it one endpoint at a time, and test each in your API client before moving on.
---

</details>
