const Roles = Object.freeze({
  ADMIN: "admin",
  CLIENT: "client",
  CUSTOMER: "customer",
});

const ROLE_VALUES = Object.freeze(Object.values(Roles));

function isValidRole(value) {
  return ROLE_VALUES.includes(value);
}

module.exports = {
  Roles,
  ROLE_VALUES,
  isValidRole,
};
