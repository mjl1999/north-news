const db = require("../db/connection");

exports.retrieveTopics = async () => {
  const query = "SELECT * FROM topics;";
  const result = await db.query(query);
  return result.rows;
};

exports.retrieveArticle = async (id) => {
  if (Number.isInteger(Number(id))) {
    const query = "SELECT * FROM articles WHERE article_id = $1;";
    const result = await db.query(query, [id]);
    if (result.rows.length > 0) {
      return result.rows[0];
    }
    const error = new Error("Article ID not Found");
    error.status = 404;
    throw error;
  } else {
    const error = new Error("Bad request: invalid id");
    error.status = 400;
    throw error;
  }
};

exports.retrieveAllArticles = async () => {
  //count functionality https://database.guide/sql-count-for-beginners/
  const query = `
    SELECT
    articles.article_id,
    articles.title,
    articles.topic,
    articles.author,
    articles.created_at,
    articles.votes,
    articles.article_img_url,
    COUNT(comment_id) AS comment_count
    FROM articles LEFT JOIN comments ON articles.article_id = comments.article_id
    GROUP BY articles.article_id
    ORDER BY articles.created_at DESC;`;

  const articles = await db.query(query);
  articles.rows.forEach((obj) => {
    obj["comment_count"] = Number(obj["comment_count"]);
  });
  return articles.rows;
};

exports.retrieveArticleComments = async (article_id) => {
  await this.retrieveArticle(article_id);
  const query = `SELECT * FROM comments WHERE article_id = $1 ORDER BY created_at DESC;`;
  const comments = await db.query(query, [article_id]);
  return comments.rows;
};

exports.postComment = async (article_id, username, body) => {
  await this.retrieveArticle(article_id);
  const query = `INSERT INTO comments (article_id, author, body, created_at)
  VALUES ($1, $2, $3, NOW()) 
  RETURNING *;`

  const newComment = await db.query(query, [article_id, username, body])

  return newComment.rows[0]
};


exports.patchArticle = async (article_id, inc_votes) => {
  await this.retrieveArticle(article_id);
  const query = `
  UPDATE articles 
  SET votes = votes + $1 
  WHERE article_id = $2 RETURNING *;`;

  const updatedArticle = await db.query(query, [inc_votes, article_id])
  return updatedArticle.rows[0]

}


exports.removeComment = async (comment_id) => {
  if (!Number.isInteger(Number(comment_id))) {
    return Promise.reject({status: 400, msg: "Bad request"})
  }
  const query = `DELETE FROM comments WHERE comment_id = $1 RETURNING *;`
  const deletedComment = await db.query(query, [comment_id])
 
  if (deletedComment.rows.length === 0) {
    return Promise.reject({status: 404, msg: "Comment Id not found"})
  } 

  return true

}