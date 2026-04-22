const ServiceTypes = Object.freeze({
  DRIVER: "driver",
  PROPERTY_OWNER: "property_owner",
  TOURIST_SERVICES: "tourist_services",
});

const SERVICE_TYPE_VALUES = Object.freeze(Object.values(ServiceTypes));

function isValidServiceType(value) {
  return SERVICE_TYPE_VALUES.includes(value);
}

module.exports = {
  ServiceTypes,
  SERVICE_TYPE_VALUES,
  isValidServiceType,
};
