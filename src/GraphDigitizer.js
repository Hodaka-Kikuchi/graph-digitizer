// npm start
// npm run build
// npm run deploy

import React, { useRef, useState, useEffect } from "react";

import {
  Stage,
  Layer,
  Image,
  Rect,
  Circle,
  Transformer,
} from "react-konva";

import * as pdfjsLib from "pdfjs-dist";

// ======================
// PDF Worker
// ======================
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

// ======================
// MAIN
// ======================
export default function GraphDigitizer() {

  const stageRef = useRef();
  const rectRef = useRef();
  const trRef = useRef();

  // ======================
  // STATE
  // ======================
  const [imgObj, setImgObj] = useState(null);

  const [rect, setRect] = useState({
    x: 50,
    y: 50,
    width: 300,
    height: 200,
  });

  const [points, setPoints] = useState([]);
  const [selected, setSelected] = useState([]);

  const [scale, setScale] = useState(1);

  const [axis, setAxis] = useState({
    xmin: "0",
    xmax: "10",
    ymin: "0",
    ymax: "10",
  });

  const [logX, setLogX] = useState(false);
  const [logY, setLogY] = useState(false);

  // ======================
  // TRANSFORMER
  // ======================
  useEffect(() => {
    if (rectRef.current && trRef.current) {
      trRef.current.nodes([rectRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [imgObj]);

  // ======================
  // FILE LOAD
  // ======================
  const handleFile = (e) => {

    const file = e.target.files[0];

    if (!file) return;

    // ======================
    // PDF
    // ======================
    if (file.type === "application/pdf") {

      const reader = new FileReader();

      reader.onload = async function () {

        try {

          const typedArray = new Uint8Array(this.result);

          const pdf = await pdfjsLib
            .getDocument({ data: typedArray })
            .promise;

          const page = await pdf.getPage(1);

          const viewport = page.getViewport({
            scale: 2,
          });

          const canvas = document.createElement("canvas");

          const ctx = canvas.getContext("2d");

          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({
            canvasContext: ctx,
            viewport,
          }).promise;

          loadImage(canvas.toDataURL());

        } catch (err) {

          console.error("PDF ERROR:", err);

          alert("PDF load failed.");

        }
      };

      reader.readAsArrayBuffer(file);

    }

    // ======================
    // IMAGE
    // ======================
    else {

      const reader = new FileReader();

      reader.onload = () => {
        loadImage(reader.result);
      };

      reader.readAsDataURL(file);
    }
  };

  // ======================
  // LOAD IMAGE
  // ======================
  const loadImage = (src) => {

    const img = new window.Image();

    img.src = src;

    img.onload = () => {

      const maxWidth = 800;

      const s = Math.min(1, maxWidth / img.width);

      setScale(s);

      setImgObj(img);
    };
  };

  // ======================
  // X TRANSFORM
  // ======================
  const transformX = (xNorm) => {

    const xmin = parseFloat(axis.xmin);
    const xmax = parseFloat(axis.xmax);

    // linear
    if (!logX) {

      return xmin + xNorm * (xmax - xmin);

    }

    // log10
    const lx = Math.log10(xmin);
    const ux = Math.log10(xmax);

    return Math.pow(
      10,
      lx + xNorm * (ux - lx)
    );
  };

  // ======================
  // Y TRANSFORM
  // ======================
  const transformY = (yNorm) => {

    const ymin = parseFloat(axis.ymin);
    const ymax = parseFloat(axis.ymax);

    // linear
    if (!logY) {

      return ymin + yNorm * (ymax - ymin);

    }

    // log10
    const ly = Math.log10(ymin);
    const uy = Math.log10(ymax);

    return Math.pow(
      10,
      ly + yNorm * (uy - ly)
    );
  };

  // ======================
  // CLICK
  // ======================
  const handleClick = () => {

    const stage = stageRef.current;

    const pos = stage.getPointerPosition();

    if (!pos) return;

    const x0 = rect.x;
    const y0 = rect.y;

    const xNorm =
      (pos.x - x0) / rect.width;

    const yNorm =
      1 - (pos.y - y0) / rect.height;

    const xVal = transformX(xNorm);
    const yVal = transformY(yNorm);

    setPoints([
      ...points,
      {
        x: xVal,
        y: yVal,
        px: pos.x,
        py: pos.y,
      },
    ]);
  };

  // ======================
  // DELETE SELECTED
  // ======================
  const deleteSelected = () => {

    setPoints(
      points.filter(
        (_, i) => !selected.includes(i)
      )
    );

    setSelected([]);
  };

  // ======================
  // CLEAR ALL
  // ======================
  const clearAll = () => {

    setPoints([]);

    setSelected([]);
  };


  // ======================
  // SAVE CSV
  // ======================
  const saveCSV = () => {

    let csv = "X,Y\n";

    points.forEach((p) => {

      csv += `${p.x},${p.y}\n`;

    });

    // ======================
    // filename input
    // ======================
    const filename = prompt(
      "Please enter filename.",
      "data.csv"
    );

    // ======================
    // cancel -> stop
    // ======================
    if (filename === null) {
      return;
    }

    // empty name -> default
    const finalName =
      filename.trim() === ""
        ? "data.csv"
        : filename;

    const blob = new Blob(
      [csv],
      { type: "text/csv" }
    );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;

    a.download = finalName;

    a.click();

    URL.revokeObjectURL(url);
  };

  // ======================
  // UI
  // ======================
  return (

    <div
      style={{
        display: "flex",
        height: "100vh",
      }}
    >

      {/* ================= LEFT PANEL ================= */}
      <div
        style={{
          width: 320,
          padding: 10,
          overflowY: "auto",
          borderRight: "1px solid gray",
        }}
      >

        {/* FILE */}
        <input
          type="file"
          onChange={handleFile}
        />

        <hr />

        {/* SCALE */}
        <div>

          <div>
            Scale: {scale.toFixed(2)}
          </div>

          <input
            type="range"
            min="0.1"
            max="2"
            step="0.05"
            value={scale}
            onChange={(e) =>
              setScale(+e.target.value)
            }
          />

        </div>

        <hr />

        {/* ================= X AXIS ================= */}
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
          }}
        >

          <strong>X Axis</strong>

          <button
            onClick={() =>
              setLogX(!logX)
            }
          >
            log10 X:
            {logX ? " ON" : " OFF"}
          </button>

        </div>

        <div style={{ marginTop: 10 }}>
          X min
        </div>

        <input
          value={axis.xmin}
          onChange={(e) =>
            setAxis({
              ...axis,
              xmin: e.target.value,
            })
          }
        />

        <div style={{ marginTop: 10 }}>
          X max
        </div>

        <input
          value={axis.xmax}
          onChange={(e) =>
            setAxis({
              ...axis,
              xmax: e.target.value,
            })
          }
        />

        <hr />

        {/* ================= Y AXIS ================= */}
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
          }}
        >

          <strong>Y Axis</strong>

          <button
            onClick={() =>
              setLogY(!logY)
            }
          >
            log10 Y:
            {logY ? " ON" : " OFF"}
          </button>

        </div>

        <div style={{ marginTop: 10 }}>
          Y min
        </div>

        <input
          value={axis.ymin}
          onChange={(e) =>
            setAxis({
              ...axis,
              ymin: e.target.value,
            })
          }
        />

        <div style={{ marginTop: 10 }}>
          Y max
        </div>

        <input
          value={axis.ymax}
          onChange={(e) =>
            setAxis({
              ...axis,
              ymax: e.target.value,
            })
          }
        />

        <hr />

        {/* ================= XY TABLE ================= */}
        <div>

          <h3>XY Data</h3>

          {/* ================= BUTTONS ================= */}
          <div
            style={{
              marginBottom: 10,
            }}
          >

            {/* SAVE */}
            <div
              style={{
                marginBottom: 8,
              }}
            >

              <button
                onClick={saveCSV}
                style={{
                  width: "100%",
                }}
              >
                Save CSV File
              </button>

            </div>

            {/* DELETE */}
            <div
              style={{
                display: "flex",
                gap: 5,
              }}
            >

              <button
                onClick={deleteSelected}
                style={{
                  flex: 1,
                }}
              >
                Delete Selected Datas
              </button>

              <button
                onClick={clearAll}
                style={{
                  flex: 1,
                }}
              >
                Delete All Datas
              </button>

            </div>

          </div>

          {/* ================= TABLE ================= */}
          <table border="1">

            <thead>

              <tr>
                <th></th>
                <th>X</th>
                <th>Y</th>
              </tr>

            </thead>

            <tbody>

              {points.map((p, i) => (

                <tr key={i}>

                  <td>

                    <input
                      type="checkbox"
                      checked={
                        selected.includes(i)
                      }

                      onChange={(e) => {

                        if (
                          e.target.checked
                        ) {

                          setSelected([
                            ...selected,
                            i,
                          ]);

                        } else {

                          setSelected(
                            selected.filter(
                              (x) => x !== i
                            )
                          );
                        }
                      }}
                    />

                  </td>

                  <td>
                    {p.x.toFixed(4)}
                  </td>

                  <td>
                    {p.y.toFixed(4)}
                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </div>

      {/* ================= CANVAS ================= */}
      <div style={{ flex: 1 }}>

        <Stage
          width={window.innerWidth - 320}
          height={window.innerHeight}
          ref={stageRef}
          onClick={handleClick}
        >

          <Layer>

            {/* IMAGE */}
            {imgObj && (

              <Image
                image={imgObj}
                scaleX={scale}
                scaleY={scale}
              />

            )}

            {/* RECT */}
            <Rect
              ref={rectRef}

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

              onTransformEnd={() => {

                const node =
                  rectRef.current;

                setRect({
                  x: node.x(),
                  y: node.y(),
                  width:
                    node.width()
                    * node.scaleX(),

                  height:
                    node.height()
                    * node.scaleY(),
                });

                node.scaleX(1);
                node.scaleY(1);
              }}
            />

            {/* TRANSFORMER */}
            <Transformer ref={trRef} />

            {/* POINTS */}
            {points.map((p, i) => (

              <Circle
                key={i}

                x={p.px}
                y={p.py}

                radius={4}

                fill={
                  selected.includes(i)
                    ? "blue"
                    : "red"
                }
              />

            ))}

          </Layer>

        </Stage>

      </div>

    </div>
  );
}