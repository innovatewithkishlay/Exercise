const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const basicAuth = require("basic-auth");
const axios = require("axios");
const User = require("./models/User");
const Transaction = require("./models/Transaction");
const authMiddleware = require("./middleware/auth");

const app = express();
app.use(express.json());

// User Registration
app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (await User.findOne({ username })) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const user = new User({ username, password });
    await user.save();

    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Fund Account
app.post("/fund", authMiddleware, async (req, res) => {
  try {
    const { amt } = req.body;
    if (amt <= 0) return res.status(400).json({ error: "Invalid amount" });

    req.user.balance += amt;
    await req.user.save();

    await Transaction.create({
      user: req.user._id,
      kind: "credit",
      amt,
      updated_bal: req.user.balance,
    });

    res.json({ balance: req.user.balance });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Pay Another User
app.post("/pay", authMiddleware, async (req, res) => {
  try {
    const { to, amt } = req.body;
    if (amt <= 0) return res.status(400).json({ error: "Invalid amount" });
    if (req.user.balance < amt)
      return res.status(400).json({ error: "Insufficient funds" });

    const recipient = await User.findOne({ username: to });
    if (!recipient)
      return res.status(400).json({ error: "Recipient not found" });

    req.user.balance -= amt;
    recipient.balance += amt;

    await Promise.all([req.user.save(), recipient.save()]);

    await Transaction.create({
      user: req.user._id,
      kind: "debit",
      amt,
      updated_bal: req.user.balance,
    });

    res.json({ balance: req.user.balance });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Check Balance
app.get("/bal", authMiddleware, async (req, res) => {
  try {
    const { currency = "INR" } = req.query;

    if (currency === "INR") {
      return res.json({ balance: req.user.balance });
    }

    const response = await axios.get(`https://open.er-api.com/v6/latest/INR`);
    const rate = response.data.rates[currency];
    if (!rate) return res.status(400).json({ error: "Invalid currency" });

    res.json({ balance: Math.round(req.user.balance * rate) });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Transaction History
app.get("/stmt", authMiddleware, async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user._id })
      .sort("-timestamp")
      .select("kind amt updated_bal timestamp");

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = app;
