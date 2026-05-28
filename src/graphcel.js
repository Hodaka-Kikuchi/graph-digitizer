import React, { useRef, useState } from "react";
import { Stage, Layer, Image, Rect, Circle } from "react-konva";
import Konva from "konva";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export default function GraphDigitizer() {
  const stageRef = useRef();

  const [img, setImg] = useState(null);
  const [imgObj, setImgObj] = useState(null);

  const [rect, setRect] = useState({
    x: 50,
    y: 50,
    width: 300,
    height: 200,
  });

  const [points, setPoints] = useState([]);

  const [axis, setAxis] = useState({
    xmin: 0,
    xmax: 1,
    ymin: 0,
    ymax: 1,
  });

  const [mode, setMode] = useState("move"); // move | pick

  // ======================
  // 画像 / PDF読み込み
  // ======================
  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type === "application/pdf") {
      const reader = new FileReader();
      reader.onload = async function () {
        const typedarray = new Uint8Array(this.result);

        const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2 });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: ctx,
          viewport,
        }).promise;

        loadImageFromCanvas(canvas);
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new window.Image();
        image.src = reader.result;
        image.onload = () => {
          setImgObj(image);
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const loadImageFromCanvas = (canvas) => {
    const image = new window.Image();
    image.src = canvas.toDataURL();
    image.onload = () => setImgObj(image);
  };

  // ======================
  // クリック → データ取得
  // ======================
  const handleClick = (e) => {
    if (mode !== "pick") return;
    if (!imgObj) return;

    const stage = stageRef.current;
    const pos = stage.getPointerPosition();

    const x0 = rect.x;
    const y0 = rect.y;

    const xNorm = (pos.x - x0) / rect.width;
    const yNorm = 1 - (pos.y - y0) / rect.height;

    const xVal =
      axis.xmin + xNorm * (axis.xmax - axis.xmin);
    const yVal =
      axis.ymin + yNorm * (axis.ymax - axis.ymin);

    const newPoints = [...points, { x: xVal, y: yVal, px: pos.x, py: pos.y }];
    setPoints(newPoints);
  };

  // ======================
  // CSV保存
  // ======================
  const saveCSV = () => {
    let csv = "X,Y\n";
    points.forEach((p) => {
      csv += `${p.x},${p.y}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "data.csv";
    a.click();
  };

  return (
    <div style={{ display: "flex", gap: 10 }}>
      {/* ===== 左UI ===== */}
      <div>
        <input type="file" onChange={handleFile} />

        <button onClick={() => setMode("pick")}>
          データ取得モード
        </button>

        <button onClick={saveCSV}>CSV保存</button>

        <div>
          xmin
          <input
            value={axis.xmin}
            onChange={(e) =>
              setAxis({ ...axis, xmin: +e.target.value })
            }
          />
          xmax
          <input
            value={axis.xmax}
            onChange={(e) =>
              setAxis({ ...axis, xmax: +e.target.value })
            }
          />
        </div>

        <div>
          ymin
          <input
            value={axis.ymin}
            onChange={(e) =>
              setAxis({ ...axis, ymin: +e.target.value })
            }
          />
          ymax
          <input
            value={axis.ymax}
            onChange={(e) =>
              setAxis({ ...axis, ymax: +e.target.value })
            }
          />
        </div>

        <table border="1">
          <thead>
            <tr>
              <th>X</th>
              <th>Y</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={i}>
                <td>{p.x.toFixed(4)}</td>
                <td>{p.y.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ===== Canvas ===== */}
      <Stage
        width={800}
        height={600}
        ref={stageRef}
        onClick={handleClick}
      >
        <Layer>
          {imgObj && (
            <Image image={imgObj} x={0} y={0} />
          )}

          {/* ROI rectangle */}
          <Rect
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            stroke="red"
            draggable
            onDragEnd={(e) =>
              setRect({
                ...rect,
                x: e.target.x(),
                y: e.target.y(),
              })
            }
            onTransformEnd={(e) => {
              const node = e.target;
              setRect({
                ...rect,
                x: node.x(),
                y: node.y(),
                width: node.width() * node.scaleX(),
                height: node.height() * node.scaleY(),
              });
              node.scaleX(1);
              node.scaleY(1);
            }}
          />

          {/* points */}
          {points.map((p, i) => (
            <Circle
              key={i}
              x={p.px}
              y={p.py}
              radius={4}
              fill="red"
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}