const mongoose = require("mongoose");
const User = require("../models/User");
const Booking = require("../models/Booking");
const ProviderApplication = require("../models/ProviderApplication");

function parseDate(value) {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildCreatedAtFilter({ from, to }) {
  const fromDate = parseDate(from);
  const toDate = parseDate(to);
  if (!fromDate && !toDate) return null;
  const createdAt = {};
  if (fromDate) createdAt.$gte = fromDate;
  if (toDate) createdAt.$lte = toDate;
  return { createdAt };
}

function pickSort(
  { sort, direction },
  allowed = ["createdAt", "amount", "status"],
) {
  const key = allowed.includes(String(sort)) ? String(sort) : "createdAt";
  const dir = String(direction).toLowerCase() === "asc" ? 1 : -1;
  return { [key]: dir };
}

exports.getDashboard = async (req, res) => {
  try {
    const {
      from,
      to,
      bookingStatus,
      serviceType,
      providerUserId,
      customerUserId,
      applicationStatus,
      page = 1,
      limit = 10,
      sort = "createdAt",
      direction = "desc",
    } = req.query;

    const createdAtFilter = buildCreatedAtFilter({ from, to });

    const usersMatch = createdAtFilter ? { ...createdAtFilter } : {};

    const bookingMatch = {
      ...(createdAtFilter ? createdAtFilter : {}),
    };

    if (bookingStatus)
      bookingMatch.status = String(bookingStatus).toLowerCase();
    if (serviceType)
      bookingMatch.serviceType = String(serviceType).toLowerCase();

    if (providerUserId) {
      if (!mongoose.isValidObjectId(providerUserId)) {
        return res
          .status(400)
          .json({ success: false, message: "providerUserId is invalid" });
      }
      bookingMatch.providerUserId = new mongoose.Types.ObjectId(providerUserId);
    }

    if (customerUserId) {
      if (!mongoose.isValidObjectId(customerUserId)) {
        return res
          .status(400)
          .json({ success: false, message: "customerUserId is invalid" });
      }
      bookingMatch.customerUserId = new mongoose.Types.ObjectId(customerUserId);
    }

    const applicationsMatch = {
      ...(createdAtFilter ? createdAtFilter : {}),
    };
    if (applicationStatus)
      applicationsMatch.status = String(applicationStatus).toLowerCase();

    const bookingsSort = pickSort({ sort, direction });
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));

    const [
      totalUsers,
      usersByRole,
      usersByActivation,
      totalBalance,
      totalBookings,
      bookingsByStatus,
      bookingsByServiceType,
      bookingAmountTotals,
      recentBookingsTotal,
      recentBookings,
      totalApplications,
      applicationsByStatus,
      recentApplications,
    ] = await Promise.all([
      User.countDocuments(usersMatch),
      User.aggregate([
        { $match: usersMatch },
        { $unwind: { path: "$roles", preserveNullAndEmptyArrays: true } },
        { $group: { _id: "$roles", count: { $sum: 1 } } },
      ]),
      User.aggregate([
        { $match: usersMatch },
        { $group: { _id: "$activated", count: { $sum: 1 } } },
      ]),
      User.aggregate([
        { $match: usersMatch },
        {
          $group: { _id: null, total: { $sum: { $ifNull: ["$balance", 0] } } },
        },
      ]),
      Booking.countDocuments(bookingMatch),
      Booking.aggregate([
        { $match: bookingMatch },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Booking.aggregate([
        { $match: bookingMatch },
        { $group: { _id: "$serviceType", count: { $sum: 1 } } },
      ]),
      Booking.aggregate([
        { $match: bookingMatch },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: { $ifNull: ["$amount", 0] } },
            completedAmount: {
              $sum: {
                $cond: [
                  { $eq: ["$status", Booking.Statuses.COMPLETED] },
                  { $ifNull: ["$amount", 0] },
                  0,
                ],
              },
            },
          },
        },
      ]),
      Booking.countDocuments(bookingMatch),
      Booking.find(bookingMatch)
        .sort(bookingsSort)
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .populate("customerUserId", "username email")
        .populate("providerUserId", "username email")
        .lean(),
      ProviderApplication.countDocuments(applicationsMatch),
      ProviderApplication.aggregate([
        { $match: applicationsMatch },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      ProviderApplication.find(applicationsMatch)
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("applicantUserId", "username email")
        .lean(),
    ]);

    const usersByRoleMap = Object.fromEntries(
      (usersByRole || []).map((x) => [String(x._id || "unknown"), x.count]),
    );

    const usersByActivationMap = Object.fromEntries(
      (usersByActivation || []).map((x) => [String(x._id), x.count]),
    );

    const bookingsByStatusMap = Object.fromEntries(
      (bookingsByStatus || []).map((x) => [
        String(x._id || "unknown"),
        x.count,
      ]),
    );

    const bookingsByServiceTypeMap = Object.fromEntries(
      (bookingsByServiceType || []).map((x) => [
        String(x._id || "unknown"),
        x.count,
      ]),
    );

    const applicationsByStatusMap = Object.fromEntries(
      (applicationsByStatus || []).map((x) => [
        String(x._id || "unknown"),
        x.count,
      ]),
    );

    const balanceTotal =
      Array.isArray(totalBalance) && totalBalance[0]
        ? Number(totalBalance[0].total || 0)
        : 0;

    const amountTotals =
      Array.isArray(bookingAmountTotals) && bookingAmountTotals[0]
        ? {
            totalAmount: Number(bookingAmountTotals[0].totalAmount || 0),
            completedAmount: Number(
              bookingAmountTotals[0].completedAmount || 0,
            ),
          }
        : { totalAmount: 0, completedAmount: 0 };

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          byRole: usersByRoleMap,
          byActivation: usersByActivationMap,
          totalBalance: balanceTotal,
        },
        bookings: {
          total: totalBookings,
          byStatus: bookingsByStatusMap,
          byServiceType: bookingsByServiceTypeMap,
          amountTotals: amountTotals,
          recent: recentBookings,
        },
        applications: {
          total: totalApplications,
          byStatus: applicationsByStatusMap,
          recent: recentApplications,
        },
      },
      meta: {
        page: safePage,
        limit: safeLimit,
        totalBookings: recentBookingsTotal,
        totalPages: Math.max(1, Math.ceil(recentBookingsTotal / safeLimit)),
        sort: bookingsSort,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard data.",
      error: err.message,
    });
  }
};

exports.listBookings = async (req, res) => {
  try {
    const {
      from,
      to,
      status,
      serviceType,
      providerUserId,
      customerUserId,
      page = 1,
      limit = 20,
      sort = "createdAt",
      direction = "desc",
    } = req.query;

    const createdAtFilter = buildCreatedAtFilter({ from, to });
    const match = {
      ...(createdAtFilter ? createdAtFilter : {}),
    };

    if (status) match.status = String(status).toLowerCase();
    if (serviceType) match.serviceType = String(serviceType).toLowerCase();

    if (providerUserId) {
      if (!mongoose.isValidObjectId(providerUserId)) {
        return res
          .status(400)
          .json({ success: false, message: "providerUserId is invalid" });
      }
      match.providerUserId = new mongoose.Types.ObjectId(providerUserId);
    }

    if (customerUserId) {
      if (!mongoose.isValidObjectId(customerUserId)) {
        return res
          .status(400)
          .json({ success: false, message: "customerUserId is invalid" });
      }
      match.customerUserId = new mongoose.Types.ObjectId(customerUserId);
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const bookingsSort = pickSort({ sort, direction }, [
      "createdAt",
      "updatedAt",
      "amount",
      "status",
      "serviceType",
    ]);

    const [total, bookings] = await Promise.all([
      Booking.countDocuments(match),
      Booking.find(match)
        .sort(bookingsSort)
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .populate("customerUserId", "username email roles activated")
        .populate("providerUserId", "username email roles activated")
        .lean(),
    ]);

    return res.json({
      success: true,
      data: bookings,
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
        sort: bookingsSort,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to list bookings.",
      error: err.message,
    });
  }
};

exports.getBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Booking id is invalid" });
    }

    const booking = await Booking.findById(id)
      .populate("customerUserId", "username email roles activated")
      .populate("providerUserId", "username email roles activated")
      .lean();

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    return res.json({ success: true, data: booking });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch booking.",
      error: err.message,
    });
  }
};
