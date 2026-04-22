const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const ProviderApplication = require("../models/ProviderApplication");
const User = require("../models/User");
const { ServiceTypes } = require("../constants/serviceTypes");

function validateBookingData(serviceType, data) {
  if (!data || typeof data !== "object") {
    return { ok: false, message: "bookingData is required" };
  }

  if (serviceType === ServiceTypes.DRIVER) {
    const required = [
      "pickupLocation",
      "dropoffLocation",
      "pickupAt",
      "passengers",
    ];
    for (const k of required) {
      if (data[k] === undefined || data[k] === null || data[k] === "") {
        return { ok: false, message: `bookingData.${k} is required` };
      }
    }
    if (Number(data.passengers) <= 0) {
      return {
        ok: false,
        message: "bookingData.passengers must be a positive number",
      };
    }
    return { ok: true };
  }

  if (serviceType === ServiceTypes.PROPERTY_OWNER) {
    const required = ["checkIn", "checkOut", "guests"];
    for (const k of required) {
      if (data[k] === undefined || data[k] === null || data[k] === "") {
        return { ok: false, message: `bookingData.${k} is required` };
      }
    }
    if (Number(data.guests) <= 0) {
      return {
        ok: false,
        message: "bookingData.guests must be a positive number",
      };
    }
    return { ok: true };
  }

  if (serviceType === ServiceTypes.TOURIST_SERVICES) {
    const required = ["date", "participants"];
    for (const k of required) {
      if (data[k] === undefined || data[k] === null || data[k] === "") {
        return { ok: false, message: `bookingData.${k} is required` };
      }
    }
    if (Number(data.participants) <= 0) {
      return {
        ok: false,
        message: "bookingData.participants must be a positive number",
      };
    }
    return { ok: true };
  }

  return { ok: false, message: "Invalid serviceType" };
}

exports.create = async (req, res) => {
  try {
    const applicationId = req.body.applicationId;
    if (!mongoose.isValidObjectId(applicationId)) {
      return res
        .status(400)
        .json({ success: false, message: "applicationId is invalid" });
    }

    const app = await ProviderApplication.findById(applicationId);
    if (!app) {
      return res
        .status(404)
        .json({ success: false, message: "Service not found" });
    }
    if (app.status !== ProviderApplication.Statuses.APPROVED) {
      return res.status(400).json({
        success: false,
        message: "Service is not approved for booking.",
      });
    }

    const provider = await User.findById(app.applicantUserId);
    if (!provider || provider.activated !== true) {
      return res.status(400).json({
        success: false,
        message: "Provider is not active for booking.",
      });
    }

    const validation = validateBookingData(
      app.serviceType,
      req.body.bookingData,
    );
    if (!validation.ok) {
      return res
        .status(400)
        .json({ success: false, message: validation.message });
    }

    const booking = await Booking.create({
      customerUserId: req.userId,
      providerUserId: app.applicantUserId,
      applicationId: app._id,
      serviceType: app.serviceType,
      status: Booking.Statuses.REQUESTED,
      bookingData: req.body.bookingData,
    });

    res.status(201).json({
      success: true,
      message: "Booking request submitted.",
      data: booking,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to create booking.",
      error: err.message,
    });
  }
};

exports.getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ customerUserId: req.userId })
      .sort({ createdAt: -1 })
      .populate("providerUserId", "username email")
      .populate("applicationId");
    res.json({ success: true, data: bookings });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings.",
      error: err.message,
    });
  }
};

exports.getProviderBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = { providerUserId: req.userId };
    if (status) query.status = String(status).toLowerCase();

    const [total, bookings] = await Promise.all([
      Booking.countDocuments(query),
      Booking.find(query)
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .populate("customerUserId", "username email")
        .populate("applicationId"),
    ]);

    res.json({
      success: true,
      data: bookings,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.max(1, Math.ceil(total / Number(limit))),
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch provider bookings.",
      error: err.message,
    });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    const nextStatus = String(status || "").toLowerCase();
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    const isCustomer = String(booking.customerUserId) === String(req.userId);
    const isProvider = String(booking.providerUserId) === String(req.userId);

    if (!isCustomer && !isProvider) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const current = booking.status;

    // Customer actions
    if (isCustomer) {
      if (nextStatus !== Booking.Statuses.CANCELLED) {
        return res.status(400).json({
          success: false,
          message: "Customers can only cancel bookings.",
        });
      }
      if (
        ![Booking.Statuses.REQUESTED, Booking.Statuses.ACCEPTED].includes(
          current,
        )
      ) {
        return res.status(400).json({
          success: false,
          message: `Cannot cancel a booking in status '${current}'.`,
        });
      }
      booking.status = Booking.Statuses.CANCELLED;
      booking.customerDecision = { decidedAt: new Date(), note };
      await booking.save();
      return res.json({
        success: true,
        message: "Booking cancelled.",
        data: booking,
      });
    }

    // Provider actions
    if (isProvider) {
      if (
        nextStatus === Booking.Statuses.ACCEPTED ||
        nextStatus === Booking.Statuses.REJECTED
      ) {
        if (current !== Booking.Statuses.REQUESTED) {
          return res.status(400).json({
            success: false,
            message: "Only requested bookings can be accepted/rejected.",
          });
        }
        booking.status = nextStatus;
        booking.providerDecision = { decidedAt: new Date(), note };
        await booking.save();
        return res.json({
          success: true,
          message: `Booking ${nextStatus}.`,
          data: booking,
        });
      }

      if (nextStatus === Booking.Statuses.COMPLETED) {
        if (current !== Booking.Statuses.ACCEPTED) {
          return res.status(400).json({
            success: false,
            message: "Only accepted bookings can be completed.",
          });
        }
        booking.status = Booking.Statuses.COMPLETED;
        booking.providerDecision = { decidedAt: new Date(), note };
        await booking.save();
        return res.json({
          success: true,
          message: "Booking completed.",
          data: booking,
        });
      }

      return res.status(400).json({
        success: false,
        message: "Invalid status transition.",
      });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to update booking.",
      error: err.message,
    });
  }
};
