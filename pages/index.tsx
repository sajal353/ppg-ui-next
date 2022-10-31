import { useEffect, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

export default function App() {
  const [url, setUrl] = useState("192.168.0.103");
  const [isConnected, setIsConnected] = useState(false);
  const [validatingConnection, setValidatingConnection] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [last60IR, setLast60IR] = useState<number[]>(new Array(241).fill(0));
  const [last60SPO2, setLast60SPO2] = useState<number[]>(
    new Array(241).fill(0)
  );
  const [isIRValid, setIsIRValid] = useState(false);
  const [isSPO2Valid, setIsSPO2Valid] = useState(false);
  const [HR, setHR] = useState(0);
  const [meanHR, setMeanHR] = useState(0);

  const meanDivisable = useRef(0);

  const sanitizeUrl = (url: string) => {
    return `${
      url.includes("http://") || url.includes("https://")
        ? url
        : `http://${url}`
    }/data`;
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchLiveData = async () => {
    try {
      const response = await fetch(sanitizeUrl(url));
      const data = await response.json();
      setLast60IR((prev) => [...prev, data[0].value].slice(-241));
      setLast60SPO2((prev) =>
        [...prev, Number(data[1].value) > 0 ? data[1].value : 0].slice(-241)
      );
      data[0].value > 100000 ? setIsIRValid(true) : setIsIRValid(false);
      data[1].value > 50 ? setIsSPO2Valid(true) : setIsSPO2Valid(false);
    } catch (error: any) {
      console.log(error);
      setIsConnected(false);
      toast.error("Connection Error");
      setConnectionError(String(error?.message) || String(error));
      setLast60IR((prev) => {
        prev.shift();
        prev.push(0);
        return prev;
      });
      setLast60SPO2((prev) => {
        prev.shift();
        prev.push(0);
        return prev;
      });
    }
  };

  const checkIfConnectable = async () => {
    toast.promise(
      new Promise(async (resolve, reject) => {
        setValidatingConnection(true);
        try {
          const response = await fetch(sanitizeUrl(url));
          const data = await response.json();
          if (data[0].type === "IR") {
            resolve("OK");
            setIsConnected(true);
          }
        } catch (error) {
          console.log(error);
          reject(error);
        }
        setValidatingConnection(false);
      }),
      {
        loading: "Connecting...",
        success: "Connected",
        error: (err) =>
          `Failed to connect: ${err?.message || err || "Unknown Error"}`,
      }
    );
  };

  const getPeaks = async () => {
    try {
      const peaks: number[] = last60IR.slice(-41);
      const commaSeparatedData = peaks.join(",");
      const response = await fetch(`/api/peaks?array=${commaSeparatedData}`);
      const data = await response.json();
      const bpm = Number(data?.count) * 6;
      setHR(bpm);
      const peaks2: number[] = last60IR.slice(-121);
      const commaSeparatedData2 = peaks2.join(",");
      const response2 = await fetch(`/api/peaks?array=${commaSeparatedData2}`);
      const data2 = await response2.json();
      const bpm2 = Number(data2?.count) * 2;
      setMeanHR(bpm2);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    let interval: any;
    if (isConnected) {
      interval = setInterval(() => {
        if (isConnected) {
          fetchLiveData();
        }
      }, 250);
    }
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  useEffect(() => {
    getPeaks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last60IR]);

  return (
    <>
      {typeof window !== "undefined" && (
        <div className="p-8 bg-slate-900 text-white w-full">
          <h1 className="font-bold text-2xl">PPG UI</h1>
          <form
            className="url"
            onSubmit={(e) => {
              e.preventDefault();
              checkIfConnectable();
            }}
          >
            <input
              type="text"
              placeholder="ESP URL / IP"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button
              className={`${
                isConnected || validatingConnection
                  ? "opacity-50 pointer-events-none"
                  : ""
              }`}
            >
              Connect
            </button>
          </form>
          <div className="mt-4  font-thin flex gap-1">
            <p className="font-normal">Status:</p>
            {isConnected ? (
              <div className="text-green-500">Connected to {url}</div>
            ) : (
              <>
                {validatingConnection ? (
                  <div className="text-white">Connecting...</div>
                ) : (
                  <div className="text-gray-400">
                    Disconnected{connectionError && `. (${connectionError})`}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="mt-4 font-normal flex gap-2 items-center">
            <p>Live Data:</p>
            <p
              className={`text-sm font-thin
          ${isIRValid ? "text-green-500" : "text-red-400"}`}
            >
              <b className="font-normal">IR:</b> {last60IR[last60IR.length - 1]}
              {!isIRValid && " (Invalid)"}
            </p>
            <p
              className={`text-sm font-thin
          ${isSPO2Valid ? "text-green-500" : "text-red-400"}`}
            >
              <b className="font-normal">SPO2:</b>{" "}
              {isIRValid ? (
                <>
                  {last60SPO2[last60SPO2.length - 1]}%
                  {!isSPO2Valid && " (Invalid)"}
                </>
              ) : (
                "Unavailable"
              )}
            </p>
            <p className="text-sm font-thin text-green-500">
              {isIRValid && isSPO2Valid && (
                <>
                  <b className="font-normal">HR (10s window):</b> {HR} BPM{" "}
                  <b className="font-normal">HR (30s window):</b> {meanHR} BPM
                </>
              )}
            </p>
          </div>
          <div className="mt-4 flex items-center">
            <LineChart
              width={window.innerWidth / 2 - 100}
              height={window.innerHeight / 3}
              data={last60IR.slice(-41).map((val, i) => ({
                IR: val,
                name: `${(40 - i) * 0.25}s`,
              }))}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis
                domain={[
                  Math.min(...last60IR.slice(-10)),
                  Math.max(...last60IR.slice(-10)),
                ]}
              />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="IR"
                stroke="#8884d8"
                activeDot={{ r: 3 }}
                isAnimationActive={false}
                dot={false}
              />
            </LineChart>
            <LineChart
              width={window.innerWidth / 2 - 100}
              height={window.innerHeight / 3}
              data={last60SPO2.slice(-41).map((val, i) => ({
                SPO2: val,
                name: `${(40 - i) * 0.25}s`,
              }))}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="SPO2"
                stroke="#82ca9d"
                activeDot={{ r: 3 }}
                isAnimationActive={false}
                dot={false}
              />
            </LineChart>
          </div>
          <div className="mt-4">
            <LineChart
              width={window.innerWidth - 100}
              height={window.innerHeight / 3}
              data={last60IR.map((val, i) => ({
                IR: val,
                name: `${(240 - i) * 0.25}s`,
              }))}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis
                domain={[
                  Math.min(...last60IR.slice(-10)),
                  Math.max(...last60IR.slice(-10)),
                ]}
              />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="IR"
                stroke="#8884d8"
                activeDot={{ r: 3 }}
                isAnimationActive={false}
                dot={false}
              />
            </LineChart>
            <LineChart
              width={window.innerWidth - 100}
              height={window.innerHeight / 3}
              data={last60SPO2.map((val, i) => ({
                SPO2: val,
                name: `${(240 - i) * 0.25}s`,
              }))}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="SPO2"
                stroke="#82ca9d"
                activeDot={{ r: 3 }}
                isAnimationActive={false}
                dot={false}
              />
            </LineChart>
          </div>
          <Toaster />
          <div className="version">v0.02-alpha</div>
        </div>
      )}
    </>
  );
}
