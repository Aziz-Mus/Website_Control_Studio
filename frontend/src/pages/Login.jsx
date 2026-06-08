import {useState} from "react";
import {KeyRound, Loader2, User, Eye, EyeOff} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {toast} from "sonner";
import axios from "axios";
import CryptoJS from "crypto-js";

export default function Login(){
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Payload
            const payloadData = {username, password};
            const payloadString = JSON.stringify(payloadData);

            // Timestamp (detik)
            const timestamp = Math.floor(Date.now() / 1000).toString();

            const secretKey = process.env.REACT_APP_API_TOKEN;

            const messageToSign = `${timestamp}.${payloadString}`;
            const signature = CryptoJS.HmacSHA256(messageToSign, secretKey).toString(CryptoJS.enc.Hex);

            const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/auth/login`, payloadData, {
                headers: {
                    "X-Timestamp": timestamp,
                    "X-Signature": signature
                }
            });

            // Simpan data token dan role ke localStorage
            localStorage.setItem("api_token", res.data.access_token);
            localStorage.setItem("user_role", res.data.role);
            localStorage.setItem("username", res.data.username);
            toast.success(`Welcome, ${res.data.username}`);

            // Otomatis arahkan ke halaman sesuai Role
            const role = res.data.role;
            if (role === "admin") navigate("/showcase");
            else if (role === "showcase_room") navigate("/showcase");
            else if (role === "command_center") navigate("/command-center");
            else if (role === "studio_neon_control") navigate("/studio/neon");
            else if (role === "studio_main_headlight") navigate("/studio/headlights");
            else if (role === "studio_ac_control") navigate("/studio/ac");
            else if (role === "studio_all") navigate("/studio");
            else navigate("/showcase");
        } catch (err) {
            toast.error("Wrong username or password!");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#F4F5F7] p-4 relative">
            {/* Background Decorative - warna merah tipis di sudut */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[15%] -right-[10%] w-[45%] h-[45%] rounded-full bg-[#DA2C38]/5 blur-[100px]"></div>
                <div className="absolute -bottom-[15%] -left-[10%] w-[40%] h-[40%] rounded-full bg-[#DA2C38]/5 blur-[100px]"></div>
            </div>

            <div className="w-full max-w-[400px] relative z-10">
                <div className="bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">

                    {/* Header strip merah dengan logo */}
                    <div className="bg-[#DA2C38] px-8 py-6 sm:px-8 sm:py-6 flex flex-row items-center justify-center gap-3">
                        <img
                            src="/Logo_Tab_NOBG.png"
                            alt="Logo"
                            className="h-9 sm:h-12 w-auto brightness-0 invert"
                        />
                        <div className="w-px h-4 bg-white/30" />
                        <span
                            className="text-white text-m font-semibold tracking-widest uppercase opacity-90"
                            style={{ fontFamily: "Work Sans, sans-serif" }}
                        >
                            STUDIO
                        </span>
                    </div>

                    {/* Form area */}
                    <div className="px-8 py-8 sm:px-8 sm:py-8">
                        <div className="text-center mb-7">
                            <h1
                                className="text-lg sm:text-xl font-bold text-[#1C2025] mb-1"
                                style={{ fontFamily: "Work Sans, sans-serif" }}
                            >
                                Web Control Studio
                            </h1>
                            <p className="text-sm text-[#637083]">
                                Sign in to continue access control
                            </p>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-5">
                            {/* Username */}
                            <div className="space-y-1.5">
                                <label
                                    className="text-sm font-medium text-[#1C2025]"
                                    style={{ fontFamily: "Work Sans, sans-serif" }}
                                >
                                    Username
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#637083]"/>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full bg-[#F9FAFB] border border-gray-200 text-[#1C2025] rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#DA2C38]/40 focus:border-[#DA2C38] transition-all placeholder:text-gray-400"
                                        placeholder="Username"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="space-y-1.5">
                                <label
                                    className="text-sm font-medium text-[#1C2025]"
                                    style={{ fontFamily: "Work Sans, sans-serif" }}
                                >
                                    Password
                                </label>
                                <div className="relative">
                                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#637083]" />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-[#F9FAFB] border border-gray-200 text-[#1C2025] rounded-lg py-2.5 pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#DA2C38]/40 focus:border-[#DA2C38] transition-all placeholder:text-gray-400"
                                        placeholder="••••••••"
                                        required
                                    />
                                    {/* Tombol Icon Show/Hide */}
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#637083] hover:text-[#1C2025] transition-colors focus:outline-none"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="w-4 h-4" />
                                        ) : (
                                            <Eye className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[#DA2C38] hover:bg-[#b52330] active:bg-[#a01f2b] text-white font-semibold py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 mt-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                                style={{ fontFamily: "Work Sans, sans-serif" }}
                            >
                                {loading
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Memverifikasi...</>
                                    : "Sign In"
                                }
                            </button>
                        </form>
                    </div>
                </div>

                {/* Footer credit */}
                <p className="text-center text-xs text-[#637083] mt-4 mb-4 opacity-60">
                    Web Control Studio © 2026
                </p>
            </div>
        </div>
    )
}