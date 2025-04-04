const db = require("../db/connection");

exports.retrieveTopics = async () => {
  const query = "SELECT * FROM topics;";
  const result = await db.query(query);
  return result.rows;
};

exports.retrieveArticle = async (id) => {
  if (Number.isInteger(Number(id))) {
    const query = `
    SELECT
    articles.article_id,
    articles.title,
    articles.topic,
    articles.body,
    articles.author,
    articles.created_at,
    articles.votes,
    articles.article_img_url,
    COUNT(comment_id) AS comment_count 
    FROM articles LEFT JOIN comments ON articles.article_id = comments.article_id 
    WHERE articles.article_id = $1
    GROUP BY articles.article_id;`;
    const result = await db.query(query, [id]);
    if (result.rows.length > 0) {
      const article = result.rows[0];
      article["comment_count"] = Number(article["comment_count"]);
      return article;
    }
    return Promise.reject({ status: 404, msg: "Article ID not Found" });
  } else {
    return Promise.reject({ status: 400, msg: "Bad Request: invalid id" });
  }
};

exports.retrieveAllArticles = async (
  sort_by = "created_at",
  order = "DESC",
  topic
) => {
  const dataColumns = [
    "article_id",
    "title",
    "topic",
    "author",
    "created_at",
    "votes",
    "article_img_url",
  ];
  const topicColumns = ["mitch", "paper", "cats"];

  if (!dataColumns.includes(sort_by)) {
    return Promise.reject({ status: 400, msg: "Invalid sort_by column" });
  }
  if (order.toUpperCase() !== "DESC" && order.toUpperCase() !== "ASC") {
    return Promise.reject({ status: 400, msg: "Invalid order value" });
  }

  if (topic && !topicColumns.includes(topic)) {
    return Promise.reject({ status: 404, msg: "topic Not Found" });
  }

  let query = `
    SELECT
    articles.article_id,
    articles.title,
    articles.topic,
    articles.author,
    articles.created_at,
    articles.votes,
    articles.article_img_url,
    COUNT(comment_id) AS comment_count 
    FROM articles LEFT JOIN comments ON articles.article_id = comments.article_id `;

  if (topic) {
    query += `WHERE topic = $1 `;
  }
  query += `GROUP BY articles.article_id ORDER BY articles.${sort_by} ${order.toUpperCase()};`;

  if (!topic) {
    const articles = await db.query(query);
    articles.rows.forEach((obj) => {
      obj["comment_count"] = Number(obj["comment_count"]);
    });
    return articles.rows;
  } else {
    const articles = await db.query(query, [topic]);
    articles.rows.forEach((obj) => {
      obj["comment_count"] = Number(obj["comment_count"]);
    });
    return articles.rows;
  }
};

exports.retrieveArticleComments = async (article_id) => {
  await this.retrieveArticle(article_id);
  const query = `SELECT * FROM comments WHERE article_id = $1 ORDER BY created_at DESC;`;
  const comments = await db.query(query, [article_id]);
  return comments.rows;
};

exports.postComment = async (article_id, username, body) => {
  if (!username || !body) {
    return Promise.reject({
      status: 400,
      msg: "Incomplete request body: make sure username and comment body are present",
    });
  }
  const checkUsername = await db.query(
    `SELECT * FROM users WHERE username = $1`,
    [username]
  );
  if (checkUsername.rows.length === 0) {
    return Promise.reject({ status: 400, msg: "User does not exist" });
  }
  await this.retrieveArticle(article_id);
  const query = `INSERT INTO comments (article_id, author, body, created_at)
  VALUES ($1, $2, $3, NOW()) 
  RETURNING *;`;

  const newComment = await db.query(query, [article_id, username, body]);

  return newComment.rows[0];
};

exports.patchArticle = async (article_id, inc_votes) => {
  await this.retrieveArticle(article_id);
  if (!inc_votes) {
    return Promise.reject({ status: 400, msg: "inc_votes is not defined" });
  }
  if (!Number.isInteger(Number(inc_votes))) {
    return Promise.reject({ status: 400, msg: "inc_votes is not a number" });
  }
  const query = `
  UPDATE articles 
  SET votes = votes + $1 
  WHERE article_id = $2 RETURNING *;`;

  const updatedArticle = await db.query(query, [inc_votes, article_id]);
  return updatedArticle.rows[0];
};

exports.removeComment = async (comment_id) => {
  if (!Number.isInteger(Number(comment_id))) {
    return Promise.reject({
      status: 400,
      msg: "Bad Request: invalid comment id",
    });
  }
  const query = `DELETE FROM comments WHERE comment_id = $1 RETURNING *;`;
  const deletedComment = await db.query(query, [comment_id]);

  if (deletedComment.rows.length === 0) {
    return Promise.reject({ status: 404, msg: "Comment Id Not Found" });
  }

  return;
};

exports.retrieveAllUsers = async () => {
  const query = `SELECT * FROM users;`;
  const users = await db.query(query);
  return users.rows;
};

exports.retrieveUser = async (user) => {
  const availableUsers = await db.query(`SELECT username FROM users;`);
  const userExists = availableUsers.rows.some((obj) => {
    return obj.username === user;
  });

  if (userExists) {
    const userResult = await db.query(
      `SELECT * FROM users WHERE username =$1;`,
      [user]
    );
    const userObj = userResult.rows[0];
    return userObj;
  }

  return Promise.reject({ status: 404, msg: "User Not Found" });
};

exports.patchComment = async (comment_id, inc_votes) => {
  if (!inc_votes) {
    return Promise.reject({ status: 400, msg: "inc_votes is not defined" });
  }
  if (!Number.isInteger(Number(inc_votes))) {
    return Promise.reject({ status: 400, msg: "inc_votes is not a number" });
  }
  if (!Number.isInteger(Number(comment_id))) {
    return Promise.reject({ status: 400, msg: "invalid comment_id" });
  }

  const query = `
  UPDATE comments 
  SET votes = votes + $1 
  WHERE comment_id = $2 RETURNING *;`;

  const updateComment = await db.query(query, [inc_votes, comment_id]);
  if (updateComment.rows.length === 0) {
    return Promise.reject({ status: 404, msg: "Comment ID Not Found" });
  }
  return updateComment.rows[0];
};

exports.postArticle = async (
  author,
  title,
  body,
  topic,
  article_img_url = `https://images.pexels.com/photos/97050/pexels-photo-97050.jpeg?w=700&h=700`
) => {
  if (!author || !title || !body || !topic) {
    return Promise.reject({ status: 400, msg: "Request Body Incomplete" });
  }
  const query = `INSERT INTO articles (author, title, body, topic, article_img_url)
  VALUES ($1, $2, $3, $4, $5) RETURNING article_id;`;
  const insertArticleAndGetId = await db.query(query, [
    author,
    title,
    body,
    topic,
    article_img_url,
  ]);
  const newArticleId = insertArticleAndGetId.rows[0].article_id;
  return this.retrieveArticle(newArticleId);
};

exports.postTopic = async (slug, description) => {
  if (!slug || !description) {
    return Promise.reject({ status: 400, msg: "Request Body Incomplete" });
  }
  if (typeof slug !== "string" || typeof description !== "string") {
    return Promise.reject({
      status: 400,
      msg: "Incorrect Data Types In Request Body",
    });
  }
  const query = `INSERT INTO topics (slug, description)
  VALUES ($1, $2) RETURNING *;`;
  await db.query(query, [slug, description]);
  const checkingQuery = `SELECT * FROM topics WHERE slug = $1;`
  const verifyNewTopic = await db.query(checkingQuery, [slug])
  const grabNewTopic = verifyNewTopic.rows[0]
  return grabNewTopic;
};


exports.removeArticle = async(article_id) => {
  if (!Number.isInteger(Number(article_id))) {
    return Promise.reject({
      status: 400,
      msg: "Bad Request: invalid article id",
    });
  }
  const query = `DELETE FROM articles WHERE article_id = $1 RETURNING *;`;
  const deletedComment = await db.query(query, [article_id]);

  if (deletedComment.rows.length === 0) {
    return Promise.reject({ status: 404, msg: "Article ID Not Found" });
  }

  return;

}