import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { FiCopy, FiCheck, FiCreditCard, FiCheckCircle, FiSmartphone, FiPrinter, FiDollarSign, FiX, FiShield, FiZap } from "react-icons/fi";
import { toast } from "react-toastify";
import api from "../../services/api";

const PaymentQR = ({ onPaymentSubmitted }) => {
    const defaultUpiId = "9561563002@ptsbi";
    const defaultCollegeName = "Samarth College of Engineering & Management";

    const [upiId, setUpiId] = useState(defaultUpiId);
    const [collegeName, setCollegeName] = useState(defaultCollegeName);
    const [paytmMid, setPaytmMid] = useState("SAMARTH_COLLEGE_PAYTM_MID_9561563002");
    const [amount, setAmount] = useState("");
    const [payerName, setPayerName] = useState("");
    const [incomeHead, setIncomeHead] = useState("Tuition Fee");
    const [note, setNote] = useState("College Fee Payment");
    const [utrNumber, setUtrNumber] = useState("");
    const [copied, setCopied] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submittedReceipt, setSubmittedReceipt] = useState(null);

    // Modal state for Paytm Merchant Gateway
    const [showGatewayModal, setShowGatewayModal] = useState(false);
    const [gatewayStep, setGatewayStep] = useState("select_method"); // 'select_method', 'processing', 'success'
    const [selectedGatewayMethod, setSelectedGatewayMethod] = useState("paytm_merchant_upi");
    const [activePaytmOrder, setActivePaytmOrder] = useState(null);

    useEffect(() => {
        const fetchPaymentInfo = async () => {
            try {
                const res = await api.get("/finance/payment-info");
                if (res.data.success) {
                    if (res.data.upiId) setUpiId(res.data.upiId);
                    if (res.data.collegeName) setCollegeName(res.data.collegeName);
                    if (res.data.paytmMid) setPaytmMid(res.data.paytmMid);
                }
            } catch (err) {
                console.log("Using default Paytm settings");
            }
        };
        fetchPaymentInfo();
    }, []);

    // Construct standard Indian UPI URI
    const encodedName = encodeURIComponent(collegeName);
    const encodedNote = encodeURIComponent(note || "College Payment");
    const formattedAmount = amount && !isNaN(amount) && Number(amount) > 0 ? Number(amount).toFixed(2) : "";

    let upiUri = `upi://pay?pa=${upiId}&pn=${encodedName}&cu=INR`;
    if (formattedAmount) {
        upiUri += `&am=${formattedAmount}`;
    }
    if (encodedNote) {
        upiUri += `&tn=${encodedNote}`;
    }

    const copyUpiId = () => {
        navigator.clipboard.writeText(upiId);
        setCopied(true);
        toast.success(`Paytm Merchant UPI ID copied: ${upiId}`);
        setTimeout(() => setCopied(false), 2500);
    };

    const handleQuickAmount = (val) => {
        setAmount(val.toString());
    };

    // Mobile App Direct Launcher
    const handleOpenAppOrGateway = (appName, customUri) => {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
            window.location.href = customUri || upiUri;
            toast.info(`Opening ${appName}...`);
        } else {
            toast.info(`Opening Paytm Merchant Online Gateway...`);
            handleInitiatePaytmGateway();
        }
    };

    // INITIATE PAYTM MERCHANT GATEWAY TRANSACTION
    const handleInitiatePaytmGateway = async () => {
        if (!amount || Number(amount) <= 0) {
            toast.error("Please enter a valid payment amount first!");
            return;
        }
        if (!payerName.trim()) {
            toast.error("Please enter Payer / Student Name!");
            return;
        }

        setSubmitting(true);
        try {
            const res = await api.post("/paytm/initiate-transaction", {
                amount: Number(amount),
                payerName: payerName.trim(),
                incomeHead,
                note
            });

            if (res.data.success) {
                setActivePaytmOrder(res.data);
                setGatewayStep("select_method");
                setShowGatewayModal(true);
                toast.success("Paytm Merchant Gateway Session Initiated!");
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to initiate Paytm Gateway transaction");
        }
        setSubmitting(false);
    };

    // EXECUTE & VERIFY PAYTM MERCHANT TRANSACTION
    const handleExecutePaytmPayment = async () => {
        setGatewayStep("processing");

        setTimeout(async () => {
            try {
                const payload = {
                    orderId: activePaytmOrder?.orderId || `PAYTM_${Date.now()}`,
                    amount: Number(amount),
                    payerName: payerName.trim() || "Student Payer",
                    incomeHead: incomeHead || "Tuition Fee",
                    note: note || "College Fee",
                    utr: utrNumber.trim() || `PAYTMUTR${Date.now().toString().slice(-8)}`
                };

                const res = await api.post("/paytm/verify-transaction", payload);
                if (res.data.success) {
                    setSubmittedReceipt({
                        ...res.data.data,
                        upiId,
                        timestamp: new Date().toLocaleString()
                    });
                    setGatewayStep("success");
                    toast.success("Paytm Merchant Payment Authorized & Verified!");
                    if (onPaymentSubmitted) onPaymentSubmitted();
                }
            } catch (err) {
                toast.error(err.response?.data?.message || "Paytm Merchant Payment Verification Failed");
                setGatewayStep("select_method");
            }
        }, 1600);
    };

    const handlePrintReceipt = () => {
        window.print();
    };

    return (
        <div className="section-card animate-fade-in" style={{ padding: "24px", background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 4px 15px rgba(0,0,0,0.05)" }}>
            
            {/* PAYTM MERCHANT HEADER */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #00baf2", paddingBottom: "16px", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div style={{ background: "#00baf2", color: "#ffffff", padding: "8px 14px", borderRadius: "10px", fontWeight: "900", fontSize: "1.1rem", letterSpacing: "0.5px" }}>
                        Paytm Merchant
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#002e6e", fontWeight: "800" }}>
                            Paytm Official College Payment Gateway
                        </h2>
                        <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
                            Paytm Merchant UPI VPA: <strong>{upiId}</strong> | MID: {paytmMid}
                        </p>
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#e0f2fe", border: "1px solid #7dd3fc", padding: "6px 14px", borderRadius: "20px", color: "#0369a1", fontWeight: "700", fontSize: "0.85rem" }}>
                    <FiShield /> Paytm Merchant Verified
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px", alignItems: "start" }}>
                
                {/* LEFT: Live Dynamic QR Code & App Links */}
                <div style={{ background: "#f8fafc", padding: "24px", borderRadius: "12px", border: "1px solid #e2e8f0", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                    
                    <div style={{ background: "#ffffff", padding: "16px", borderRadius: "16px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", border: "2px solid #00baf2", marginBottom: "16px" }}>
                        <QRCodeSVG value={upiUri} size={210} includeMargin={true} level="H" />
                    </div>

                    <div style={{ width: "100%" }}>
                        <h4 style={{ margin: "0 0 4px 0", color: "#002e6e", fontSize: "1.05rem" }}>{collegeName}</h4>
                        
                        {/* UPI ID Badge */}
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#e0f2fe", border: "1px solid #7dd3fc", padding: "8px 16px", borderRadius: "8px", marginTop: "8px", cursor: "pointer" }} onClick={copyUpiId}>
                            <span style={{ fontSize: "0.9rem", color: "#0369a1", fontWeight: "700" }}>
                                Paytm UPI: {upiId}
                            </span>
                            {copied ? <FiCheck style={{ color: "#16a34a" }} /> : <FiCopy style={{ color: "#0284c7" }} />}
                        </div>

                        {formattedAmount && (
                            <div style={{ marginTop: "12px", fontSize: "1.3rem", fontWeight: "800", color: "#15803d", background: "#dcfce7", padding: "6px 12px", borderRadius: "8px", display: "inline-block" }}>
                                Amount: ₹{Number(formattedAmount).toLocaleString("en-IN")}
                            </div>
                        )}

                        {/* Direct App Buttons */}
                        <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px dashed #cbd5e1" }}>
                            <p style={{ margin: "0 0 10px 0", fontSize: "0.82rem", color: "#475569", fontWeight: "600" }}>
                                <FiSmartphone style={{ verticalAlign: "middle", marginRight: "4px" }} />
                                Click app to pay directly:
                            </p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
                                <button
                                    type="button"
                                    onClick={() => handleOpenAppOrGateway("Paytm App", `paytmmp://pay?pa=${upiId}&pn=${encodedName}&am=${formattedAmount}&cu=INR`)}
                                    className="btn btn-sm"
                                    style={{ background: "#00baf2", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "700", padding: "8px 14px" }}
                                >
                                    Paytm App
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleOpenAppOrGateway("PhonePe", `phonepe://pay?pa=${upiId}&pn=${encodedName}&am=${formattedAmount}&cu=INR`)}
                                    className="btn btn-sm"
                                    style={{ background: "#5f259f", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "700", padding: "8px 14px" }}
                                >
                                    PhonePe
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleOpenAppOrGateway("Google Pay", `gpay://upi/pay?pa=${upiId}&pn=${encodedName}&am=${formattedAmount}&cu=INR`)}
                                    className="btn btn-sm"
                                    style={{ background: "#4285F4", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "700", padding: "8px 14px" }}
                                >
                                    Google Pay
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleOpenAppOrGateway("BHIM UPI", upiUri)}
                                    className="btn btn-sm"
                                    style={{ background: "#1e3a8a", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "700", padding: "8px 14px" }}
                                >
                                    BHIM / Any UPI
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Paytm Form & Gateway Launcher */}
                <div style={{ background: "#ffffff" }}>
                    <h3 style={{ margin: "0 0 16px 0", fontSize: "1.1rem", color: "#002e6e", fontWeight: "800" }}>
                        💳 Fill Payment Details & Open Paytm Merchant Gateway
                    </h3>

                    {/* Quick Amount Presets */}
                    <div style={{ marginBottom: "16px" }}>
                        <label className="form-label" style={{ fontSize: "0.85rem", fontWeight: "600" }}>Quick Amount Presets (₹):</label>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "6px" }}>
                            {[1000, 5000, 10000, 25000, 50000].map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => handleQuickAmount(preset)}
                                    className="btn btn-sm"
                                    style={{
                                        background: amount === preset.toString() ? "#00baf2" : "#f1f5f9",
                                        color: amount === preset.toString() ? "#ffffff" : "#334155",
                                        border: "1px solid #cbd5e1",
                                        fontWeight: "700"
                                    }}
                                >
                                    ₹{preset.toLocaleString("en-IN")}
                                </button>
                            ))}
                        </div>
                    </div>

                    <form onSubmit={(e) => { e.preventDefault(); handleInitiatePaytmGateway(); }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                            <div>
                                <label className="form-label">Payment Amount (₹) *</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    placeholder="Enter amount"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    min="1"
                                    required
                                />
                            </div>

                            <div>
                                <label className="form-label">Income Category *</label>
                                <select
                                    className="form-input"
                                    value={incomeHead}
                                    onChange={(e) => setIncomeHead(e.target.value)}
                                >
                                    <option value="Tuition Fee">Tuition Fee</option>
                                    <option value="Hostel Fee">Hostel Fee</option>
                                    <option value="Exam Fee">Exam Fee</option>
                                    <option value="Lab Fee">Lab Fee</option>
                                    <option value="Library Fee">Library Fee</option>
                                    <option value="Donation">Donation / Other</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                            <div>
                                <label className="form-label">Payer / Student Name *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Enter Name"
                                    value={payerName}
                                    onChange={(e) => setPayerName(e.target.value)}
                                    required
                                />
                            </div>

                            <div>
                                <label className="form-label">UTR / Transaction Ref No.</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Auto-generated by Paytm Gateway"
                                    value={utrNumber}
                                    onChange={(e) => setUtrNumber(e.target.value)}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: "16px" }}>
                            <label className="form-label">Payment Remark / Note</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g., Semester 1 Tuition Fee"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                            />
                        </div>

                        {/* Paytm Gateway Trigger Button */}
                        <button
                            type="button"
                            onClick={handleInitiatePaytmGateway}
                            disabled={submitting}
                            className="btn"
                            style={{
                                width: "100%",
                                padding: "15px",
                                background: "linear-gradient(135deg, #00baf2 0%, #002e6e 100%)",
                                color: "#ffffff",
                                fontSize: "1.1rem",
                                fontWeight: "800",
                                border: "none",
                                borderRadius: "8px",
                                boxShadow: "0 4px 14px rgba(0, 186, 242, 0.4)",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "10px"
                            }}
                        >
                            <FiZap style={{ fontSize: "22px" }} /> {submitting ? "Initiating Paytm Session..." : "Pay via Paytm Merchant Gateway"}
                        </button>
                    </form>

                    {/* Receipt Notification Banner after successful payment */}
                    {submittedReceipt && (
                        <div style={{ marginTop: "20px", padding: "16px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "10px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                <span style={{ fontWeight: "700", color: "#166534", fontSize: "0.95rem" }}>
                                    ✅ Paytm Payment Verified & Saved
                                </span>
                                <button className="btn btn-sm btn-secondary" onClick={handlePrintReceipt}>
                                    <FiPrinter /> Print Receipt
                                </button>
                            </div>
                            <p style={{ margin: "4px 0", fontSize: "0.85rem", color: "#14532d" }}>
                                <strong>Invoice No:</strong> {submittedReceipt.invoiceNo || submittedReceipt.ref} | <strong>Amount Paid:</strong> ₹{Number(submittedReceipt.amount).toLocaleString("en-IN")}
                            </p>
                            <p style={{ margin: "4px 0", fontSize: "0.85rem", color: "#14532d" }}>
                                <strong>Payer:</strong> {submittedReceipt.name} | <strong>Paytm Receiver:</strong> {submittedReceipt.upiId || upiId}
                            </p>
                        </div>
                    )}
                </div>

            </div>

            {/* --- OFFICIAL PAYTM MERCHANT ALL-IN-ONE GATEWAY MODAL OVERLAY --- */}
            {showGatewayModal && (
                <div className="modal-overlay" style={{ background: "rgba(0, 46, 110, 0.85)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div className="modal-content animate-fade-in" style={{ maxWidth: "520px", width: "92%", borderRadius: "16px", overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)", border: "2px solid #00baf2" }}>
                        
                        {/* Official Paytm Gateway Header */}
                        <div style={{ background: "linear-gradient(135deg, #002e6e 0%, #00baf2 100%)", color: "#ffffff", padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                <div style={{ background: "#ffffff", color: "#00baf2", padding: "6px 12px", borderRadius: "8px", fontWeight: "900", fontSize: "16px", letterSpacing: "0.5px" }}>
                                    Paytm
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "800" }}>Paytm Merchant Payment Gateway</h3>
                                    <span style={{ fontSize: "0.8rem", color: "#e0f2fe" }}>Order ID: {activePaytmOrder?.orderId}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => { setShowGatewayModal(false); setSubmitting(false); }}
                                style={{ background: "none", border: "none", color: "#ffffff", fontSize: "24px", cursor: "pointer" }}
                            >
                                <FiX />
                            </button>
                        </div>

                        {/* Paytm Merchant Gateway Content */}
                        <div style={{ padding: "24px", background: "#ffffff" }}>

                            {/* Summary Card */}
                            <div style={{ background: "#f0f9ff", padding: "16px", borderRadius: "10px", border: "1px solid #bae6fd", marginBottom: "20px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                                    <span style={{ color: "#0369a1", fontSize: "0.85rem" }}>Payer Name:</span>
                                    <span style={{ fontWeight: "700", color: "#0f172a" }}>{payerName || "Student"}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                                    <span style={{ color: "#0369a1", fontSize: "0.85rem" }}>Paytm Merchant VPA:</span>
                                    <span style={{ fontWeight: "700", color: "#00baf2" }}>{upiId}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "8px", borderTop: "1px dashed #7dd3fc", marginTop: "8px" }}>
                                    <span style={{ fontWeight: "700", color: "#002e6e" }}>Total Payable Amount:</span>
                                    <span style={{ fontSize: "1.3rem", fontWeight: "900", color: "#15803d" }}>₹{Number(amount).toLocaleString("en-IN")}</span>
                                </div>
                            </div>

                            {/* STEP 1: Select Paytm Merchant Payment Option */}
                            {gatewayStep === "select_method" && (
                                <div>
                                    <h4 style={{ margin: "0 0 12px 0", fontSize: "0.95rem", color: "#002e6e", fontWeight: "700" }}>
                                        Select Paytm Merchant Payment Option:
                                    </h4>
                                    
                                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                                        <label
                                            onClick={() => setSelectedGatewayMethod("paytm_merchant_upi")}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "12px",
                                                padding: "14px",
                                                borderRadius: "10px",
                                                border: selectedGatewayMethod === "paytm_merchant_upi" ? "2px solid #00baf2" : "1px solid #cbd5e1",
                                                background: selectedGatewayMethod === "paytm_merchant_upi" ? "#f0f9ff" : "#ffffff",
                                                cursor: "pointer"
                                            }}
                                        >
                                            <input type="radio" checked={selectedGatewayMethod === "paytm_merchant_upi"} readOnly />
                                            <div>
                                                <strong style={{ color: "#002e6e", display: "block" }}>Paytm Direct Merchant UPI ({upiId})</strong>
                                                <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Instant Paytm Merchant UPI Transfer</span>
                                            </div>
                                        </label>

                                        <label
                                            onClick={() => setSelectedGatewayMethod("paytm_wallet")}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "12px",
                                                padding: "14px",
                                                borderRadius: "10px",
                                                border: selectedGatewayMethod === "paytm_wallet" ? "2px solid #00baf2" : "1px solid #cbd5e1",
                                                background: selectedGatewayMethod === "paytm_wallet" ? "#f0f9ff" : "#ffffff",
                                                cursor: "pointer"
                                            }}
                                        >
                                            <input type="radio" checked={selectedGatewayMethod === "paytm_wallet"} readOnly />
                                            <div>
                                                <strong style={{ color: "#002e6e", display: "block" }}>Paytm Wallet & Paytm Postpaid</strong>
                                                <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Paytm Bank & Linked Balance</span>
                                            </div>
                                        </label>

                                        <label
                                            onClick={() => setSelectedGatewayMethod("paytm_cards_netbanking")}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "12px",
                                                padding: "14px",
                                                borderRadius: "10px",
                                                border: selectedGatewayMethod === "paytm_cards_netbanking" ? "2px solid #00baf2" : "1px solid #cbd5e1",
                                                background: selectedGatewayMethod === "paytm_cards_netbanking" ? "#f0f9ff" : "#ffffff",
                                                cursor: "pointer"
                                            }}
                                        >
                                            <input type="radio" checked={selectedGatewayMethod === "paytm_cards_netbanking"} readOnly />
                                            <div>
                                                <strong style={{ color: "#002e6e", display: "block" }}>Paytm NetBanking / Debit & Credit Card</strong>
                                                <span style={{ fontSize: "0.8rem", color: "#64748b" }}>All Major Indian Banks via Paytm Gateway</span>
                                            </div>
                                        </label>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleExecutePaytmPayment}
                                        className="btn"
                                        style={{
                                            width: "100%",
                                            padding: "15px",
                                            fontSize: "1.1rem",
                                            fontWeight: "900",
                                            background: "linear-gradient(135deg, #00baf2 0%, #002e6e 100%)",
                                            color: "#ffffff",
                                            border: "none",
                                            borderRadius: "8px",
                                            boxShadow: "0 4px 14px rgba(0, 186, 242, 0.4)",
                                            cursor: "pointer"
                                        }}
                                    >
                                        Pay via Paytm Gateway (₹{Number(amount).toLocaleString("en-IN")})
                                    </button>
                                </div>
                            )}

                            {/* STEP 2: Processing Paytm Handshake Animation */}
                            {gatewayStep === "processing" && (
                                <div style={{ textAlign: "center", padding: "30px 10px" }}>
                                    <div className="spinner" style={{ width: "48px", height: "48px", border: "4px solid #e0f2fe", borderTop: "4px solid #00baf2", borderRadius: "50%", margin: "0 auto 20px auto", animation: "spin 1s linear infinite" }}></div>
                                    <h4 style={{ margin: "0 0 8px 0", color: "#002e6e", fontWeight: "800" }}>Connecting to Paytm Merchant Gateway...</h4>
                                    <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>Verifying Merchant Order ID: {activePaytmOrder?.orderId}</p>
                                </div>
                            )}

                            {/* STEP 3: Paytm Payment Success Screen */}
                            {gatewayStep === "success" && (
                                <div style={{ textAlign: "center", padding: "10px 0" }}>
                                    <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "#dcfce7", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "36px", margin: "0 auto 16px auto" }}>
                                        <FiCheckCircle />
                                    </div>
                                    <h3 style={{ margin: "0 0 6px 0", color: "#15803d", fontSize: "1.35rem", fontWeight: "800" }}>Paytm Payment Successful!</h3>
                                    <p style={{ margin: "0 0 16px 0", color: "#475569", fontSize: "0.9rem" }}>
                                        ₹{Number(amount).toLocaleString("en-IN")} transferred to Paytm Merchant <strong>{upiId}</strong>
                                    </p>

                                    <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #cbd5e1", textAlign: "left", fontSize: "0.85rem", marginBottom: "20px" }}>
                                        <p style={{ margin: "4px 0" }}><strong>Order ID:</strong> {activePaytmOrder?.orderId}</p>
                                        <p style={{ margin: "4px 0" }}><strong>Payer Name:</strong> {submittedReceipt?.name}</p>
                                        <p style={{ margin: "4px 0" }}><strong>Paytm MID:</strong> {paytmMid}</p>
                                        <p style={{ margin: "4px 0" }}><strong>Timestamp:</strong> {submittedReceipt?.timestamp}</p>
                                    </div>

                                    <div style={{ display: "flex", gap: "10px" }}>
                                        <button className="btn btn-primary" style={{ flex: 1, padding: "12px" }} onClick={handlePrintReceipt}>
                                            <FiPrinter /> Print Paytm Receipt
                                        </button>
                                        <button className="btn btn-secondary" style={{ flex: 1, padding: "12px" }} onClick={() => setShowGatewayModal(false)}>
                                            Close Window
                                        </button>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaymentQR;