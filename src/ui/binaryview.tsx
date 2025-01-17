import * as React from "react";
import { Col, Form, Row } from "react-bootstrap";

import { ByteRange, BitRange } from "../core/range";
import { Color } from "../core/color";
import { Tree } from "../core/tree";

const HEX_BYTES_PER_ROW = 16;
const HEX_BYTES_PER_GROUP = 8;

const BINARY_BYTES_PER_ROW = 8;
const BINARY_BYTES_PER_GROUP = 4;

const DEFAULT_MAX_ROWS = 1000;

type Format = "hex" | "binary";

export class BinaryView extends React.Component<
  { data: ByteRange; selected?: ByteRange | BitRange; maxRows: number; tree: Tree },
  { format: Format }
> {
  static defaultProps = {
    maxRows: DEFAULT_MAX_ROWS
  };

  scrollView: React.RefObject<HTMLDivElement> = React.createRef();

  constructor(props) {
    super(props);
    this.state = { format: "hex" };
  }

  setFormat(format: Format) {
    this.setState({ format: format });
  }

  render() {
    return (
      <>
        <Form>
          <Form.Group as={Row}>
            <Form.Label column sm={2}>
              Format
            </Form.Label>
            <Col sm={10}>
              <Form.Control
                as="select"
                value={this.state.format}
                onChange={e => {
                  // @ts-ignore
                  this.setFormat(e.target.value);
                }}
              >
                <option value="hex">Hex</option>
                <option value="binary">Binary</option>
              </Form.Control>
            </Col>
          </Form.Group>
        </Form>
        {this.state.format === "hex" && this.renderHex()}
        {this.state.format === "binary" && this.renderBinary()}
      </>
    );
  }

  componentDidUpdate(prevProps) {
    if (this.props.selected !== prevProps.selected && this.props.selected) {
      const byteStart =
        this.props.selected instanceof ByteRange
          ? this.props.selected.byteStart
          : this.props.selected.enclosingByteRange().byteStart;
      const rowStart =
        Math.floor(byteStart / HEX_BYTES_PER_ROW) * HEX_BYTES_PER_ROW;

      if (this.scrollView.current) {
        const row = this.scrollView.current.querySelector(
          `[data-byte-start="${rowStart}"]`
        );
        if (row) {
          row.scrollIntoView();
        }
      }
    }
  }

  byteColor(tree: Tree, byteNumber: number, color?: Color) {
    if (tree === undefined) {
      return Color.default();
    }

    for (const t of tree.children) {
      if (t.range.offset() <= byteNumber && byteNumber < (t.range.offset() + t.range.size())) {
        if (!t.color.isDefault()) {
          color = t.color;
        }

        const deepColor = this.byteColor(t, byteNumber, color);

        if (deepColor !== undefined) {
          color = deepColor;
        }
      }
    }

    return color;
  }

  renderHex() {
    let data = this.props.data;

    // The total number of rows required to render the data.
    let totalRows = Math.ceil(data.byteLength / HEX_BYTES_PER_ROW);

    // The rows that we are rendering. If the data is small, this is all the rows.
    let rowStart = 0;
    let rowEnd = Math.ceil(data.byteLength / HEX_BYTES_PER_ROW);

    if (totalRows > this.props.maxRows) {
      if (this.props.selected) {
        const byteStart =
          this.props.selected instanceof ByteRange
            ? this.props.selected.byteStart
            : this.props.selected.enclosingByteRange().byteStart;
        const selectionRow = Math.floor(byteStart / HEX_BYTES_PER_ROW);

        rowStart = Math.max(
          0,
          selectionRow - Math.floor((this.props.maxRows - 1) / 2)
        );
        rowEnd = rowStart + this.props.maxRows;
      } else {
        rowStart = 0;
        rowEnd = rowStart + this.props.maxRows;
      }
    }

    const bytesLeft = data.byteLength - rowStart * HEX_BYTES_PER_ROW;
    data = data.bytes(
      rowStart * HEX_BYTES_PER_ROW,
      Math.min(bytesLeft, (rowEnd - rowStart) * HEX_BYTES_PER_ROW)
    );

    return (
      <div
        className="border rounded"
        style={{
          maxHeight: "550px",
          overflowY: "scroll"
        }}
        ref={this.scrollView}
      >
        {rowStart > 0 ? <div>{rowStart} rows above...</div> : null}
        <div
          style={{
            fontFamily: "monospace",
            overflowX: "scroll",
            display: "flex",
            flexDirection: "row"
          }}
        >
          <span
            style={{
              borderColor: "black",
              borderRight: "1px solid",
              paddingRight: "5px",
              paddingLeft: "5px",
              marginRight: "10px"
            }}
          >
            {data.chunks(HEX_BYTES_PER_ROW).map((row, i) => (
              <div key={i} data-byte-start={row.byteStart.toString()}>
                <span style={{}}>
                  {row.byteStart.toString(16).padStart(8, "0")}
                </span>
              </div>
            ))}
          </span>

          <span>
            {data.chunks(HEX_BYTES_PER_ROW).map((row, k) => (
              <div key={k}>
                {row.chunks(HEX_BYTES_PER_GROUP).map((group, j) => (
                  <span style={{ paddingRight: "10px" }} key={j}>
                    {group.chunks(1).map((byte, i) => {
                      let selected = false;
                      if (this.props.selected) {
                        if (this.props.selected instanceof ByteRange) {
                          selected = this.props.selected.contains(byte);
                        } else if (this.props.selected instanceof BitRange) {
                          selected = this.props.selected
                            .enclosingByteRange()
                            .contains(byte);
                        }
                      }

                      const byteNumber = i + (j * HEX_BYTES_PER_GROUP) + (k * HEX_BYTES_PER_ROW);
                      const color = this.byteColor(this.props.tree, byteNumber, undefined) || this.props.tree.color;

                      return (
                        <span
                          style={{
                            paddingRight: "5px",
                            fontWeight: selected ? 'bold': 'normal',
                            backgroundColor: selected ? color.hex : (color.isDefault() ? "" : color.hexLighter())
                          }}
                          key={i}
                        >
                          {byte.toHex()}
                        </span>
                      );
                    })}
                  </span>
                ))}
              </div>
            ))}
          </span>
        </div>
        {rowEnd < totalRows ? (
          <div>{totalRows - rowEnd} rows below...</div>
        ) : null}
      </div>
    );
  }

  renderBinary() {
    let data = this.props.data;
    if (data.byteLength > this.props.maxRows * BINARY_BYTES_PER_ROW)
      return <div>File is too large for binary view.</div>;

    return (
      <div style={{ fontFamily: "monospace" }}>
        {data.chunks(BINARY_BYTES_PER_ROW).map((row, i) => (
          <div key={i}>
            {row.chunks(BINARY_BYTES_PER_GROUP).map((group, i) => (
              <span style={{ paddingRight: "10px" }} key={i}>
                {group.chunks(1).map((byte, i) => (
                    <span
                      style={{
                        paddingRight: "5px"
                      }}
                      key={i}
                    >
                      {byte
                        .bits(0)
                        .chunks(1)
                        .map((b, i) => {
                          let selected = false;
                          if (this.props.selected) {
                            if (this.props.selected instanceof ByteRange) {
                              selected = this.props.selected.contains(
                                b.enclosingByteRange()
                              );
                            } else if (
                              this.props.selected instanceof BitRange
                            ) {
                              selected = this.props.selected.contains(b);
                            }
                          }

                          const color = this.byteColor(this.props.tree, Math.floor(b.offset() / HEX_BYTES_PER_GROUP), undefined) || this.props.tree.color;

                          return (
                            <span
                              style={{
                                fontWeight: selected ? 'bold': 'normal',
                                backgroundColor: selected ? color.hex : (color.isDefault() ? "" : color.hexLighter())
                              }}
                              key={i}
                            >
                              {b.readBool() ? "1" : "0"}
                            </span>
                          );
                        })}
                    </span>
                  ))}
              </span>
            ))}
          </div>
        ))}
      </div>
    );
  }
}
