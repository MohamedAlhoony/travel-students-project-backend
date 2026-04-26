const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const ProviderApplication = require("../models/ProviderApplication");
const User = require("../models/User");
const BalanceTransaction = require("../models/BalanceTransaction");
const { ServiceTypes } = require("../constants/serviceTypes");

function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100) / 100;
}

async function ensureBalanceField(userId) {
  if (!mongoose.isValidObjectId(userId)) return;
  await User.updateOne(
    { _id: userId, balance: { $exists: false } },
    { $set: { balance: 0 } },
  );
}

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
    let providerUserId;
    let serviceType;

    const applicationId = req.body.applicationId;
    if (applicationId) {
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

      providerUserId = String(app.applicantUserId);
      serviceType = String(app.serviceType).toLowerCase();
    } else {
      if (!mongoose.isValidObjectId(req.body.providerUserId)) {
        return res
          .status(400)
          .json({ success: false, message: "providerUserId is invalid" });
      }

      serviceType = String(req.body.serviceType || "")
        .trim()
        .toLowerCase();
      if (!Object.values(ServiceTypes).includes(serviceType)) {
        return res.status(400).json({
          success: false,
          message: "serviceType is invalid",
        });
      }

      providerUserId = String(req.body.providerUserId);
    }

    const provider = await User.findById(providerUserId);
    if (!provider || provider.activated !== true) {
      return res.status(400).json({
        success: false,
        message: "Provider is not active for booking.",
      });
    }

    const validation = validateBookingData(
      serviceType,
      req.body.bookingData,
    );
    if (!validation.ok) {
      return res
        .status(400)
        .json({ success: false, message: validation.message });
    }

    const payWithBalance = Boolean(req.body.payWithBalance);
    const amount =
      req.body.amount !== undefined ? roundMoney(req.body.amount) : undefined;
    if (payWithBalance) {
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          message:
            "amount is required and must be a positive number when payWithBalance=true",
        });
      }

      // Debit customer first (simple escrow).
      await ensureBalanceField(req.userId);
      const updatedCustomer = await User.findOneAndUpdate(
        { _id: req.userId, balance: { $gte: amount } },
        { $inc: { balance: -amount } },
        { new: true },
      );

      if (!updatedCustomer) {
        return res.status(400).json({
          success: false,
          message: "Insufficient balance.",
        });
      }

      let booking;
      try {
        booking = await Booking.create({
          customerUserId: req.userId,
          providerUserId,
          serviceType,
          status: Booking.Statuses.REQUESTED,
          bookingData: req.body.bookingData,
          amount,
          payment: { method: "balance", debitedAt: new Date() },
        });

        await BalanceTransaction.create({
          userId: updatedCustomer._id,
          createdByUserId: updatedCustomer._id,
          type: BalanceTransaction.Types.BOOKING_DEBIT,
          amount: -amount,
          balanceAfter: Number(updatedCustomer.balance || 0),
          relatedBookingId: booking._id,
          note: "Booking created (escrow debit).",
        });
      } catch (err) {
        // Refund if booking creation fails after debit.
        const refunded = await User.findOneAndUpdate(
          { _id: req.userId },
          { $inc: { balance: amount } },
          { new: true },
        );
        if (refunded) {
          await BalanceTransaction.create({
            userId: refunded._id,
            createdByUserId: refunded._id,
            type: BalanceTransaction.Types.BOOKING_REFUND,
            amount,
            balanceAfter: Number(refunded.balance || 0),
            note: "Refund due to booking creation failure.",
          });
        }
        throw err;
      }

      return res.status(201).json({
        success: true,
        message: "Booking request submitted.",
        data: booking,
      });
    }

    // Default (no balance payment)
    const booking = await Booking.create({
      customerUserId: req.userId,
      providerUserId,
      serviceType,
      status: Booking.Statuses.REQUESTED,
      bookingData: req.body.bookingData,
      amount: Number.isFinite(amount) ? amount : undefined,
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
      .populate("providerUserId", "username email");
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
        .populate("customerUserId", "username email"),
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

    const isBalancePaid =
      booking.payment &&
      booking.payment.method === "balance" &&
      typeof booking.amount === "number" &&
      Number.isFinite(booking.amount) &&
      booking.amount > 0;

    const refundIfNeeded = async () => {
      if (!isBalancePaid) return;
      if (!booking.payment?.debitedAt) return;
      if (booking.payment?.refundedAt || booking.payment?.payoutAt) return;

      const amount = roundMoney(booking.amount);
      await ensureBalanceField(booking.customerUserId);
      const updatedCustomer = await User.findOneAndUpdate(
        { _id: booking.customerUserId },
        { $inc: { balance: amount } },
        { new: true },
      );
      if (updatedCustomer) {
        booking.payment.refundedAt = new Date();
        await booking.save();
        await BalanceTransaction.create({
          userId: updatedCustomer._id,
          createdByUserId: req.userId,
          type: BalanceTransaction.Types.BOOKING_REFUND,
          amount,
          balanceAfter: Number(updatedCustomer.balance || 0),
          relatedBookingId: booking._id,
          note: "Booking refund.",
        });
      }
    };

    const payoutIfNeeded = async () => {
      if (!isBalancePaid) return;
      if (!booking.payment?.debitedAt) return;
      if (booking.payment?.payoutAt || booking.payment?.refundedAt) return;

      const amount = roundMoney(booking.amount);
      await ensureBalanceField(booking.providerUserId);
      const updatedProvider = await User.findOneAndUpdate(
        { _id: booking.providerUserId },
        { $inc: { balance: amount } },
        { new: true },
      );
      if (updatedProvider) {
        booking.payment.payoutAt = new Date();
        await booking.save();
        await BalanceTransaction.create({
          userId: updatedProvider._id,
          createdByUserId: req.userId,
          type: BalanceTransaction.Types.BOOKING_PAYOUT,
          amount,
          balanceAfter: Number(updatedProvider.balance || 0),
          relatedBookingId: booking._id,
          note: "Booking payout to provider.",
        });
      }
    };

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

      await refundIfNeeded();

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

        if (nextStatus === Booking.Statuses.REJECTED) {
          await refundIfNeeded();
        }

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

        await payoutIfNeeded();

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
