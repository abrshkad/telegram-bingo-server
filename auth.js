const ADMIN_ID = "8294043060";

function isAdmin(userId) {
  return String(userId) === ADMIN_ID;
}

module.exports = { isAdmin };