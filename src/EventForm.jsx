import React, { Component } from "react";

import validateEvent from "./validateEvent";
import "./EventForm.css";

function pad(n) {
  return String(n).padStart(2, "0");
}

// datetime-local inputs use local wall-clock time with no timezone suffix,
// so `new Date(value)` (parse) / manual field access (format) both stay in
// local time and keep start/end elapsed-ms correct across DST.
function toDatetimeLocalString(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalString(value) {
  return new Date(value).getTime();
}

export default class EventForm extends Component {
  constructor(props) {
    super(props);
    this.state = this.stateFromProps(props);
    this.titleInputRef = React.createRef();
  }

  componentDidMount() {
    document.addEventListener("keydown", this.handleKeyDown);
    if (this.props.open) {
      this.focusTitle();
    }
  }

  componentDidUpdate(prevProps) {
    const reopened =
      this.props.open && (!prevProps.open || prevProps.initialValues !== this.props.initialValues);

    if (prevProps.initialValues !== this.props.initialValues) {
      this.setState(this.stateFromProps(this.props));
    }
    if (reopened) {
      this.focusTitle();
    }
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.handleKeyDown);
  }

  handleKeyDown = e => {
    if (e.key === "Escape" && this.props.open) {
      this.props.onClose();
    }
  };

  focusTitle() {
    if (this.titleInputRef.current) {
      this.titleInputRef.current.focus();
    }
  }

  stateFromProps(props) {
    const { initialValues, groups } = props;
    return {
      title: initialValues.title || "",
      group: initialValues.group || (groups[0] && groups[0].id) || "",
      start: toDatetimeLocalString(initialValues.start),
      end: toDatetimeLocalString(initialValues.end),
      errors: []
    };
  }

  handleChange = field => e => {
    this.setState({ [field]: e.target.value });
  };

  buildCandidate() {
    const { initialValues } = this.props;
    return {
      id: initialValues.id,
      title: this.state.title.trim(),
      group: this.state.group,
      start: fromDatetimeLocalString(this.state.start),
      end: fromDatetimeLocalString(this.state.end)
    };
  }

  isLockedOriginalEdit() {
    const { mode, initialValues, items } = this.props;
    if (mode !== "edit" || initialValues.id === undefined) return false;
    const original = items.find(item => item.id === initialValues.id);
    return !!original && original.start <= Date.now();
  }

  handleSubmit = e => {
    e.preventDefault();
    if (!this.state.start || !this.state.end) {
      this.setState({
        errors: [{ field: "duration", message: "Start and end are required." }]
      });
      return;
    }
    const candidate = this.buildCandidate();
    const errors = validateEvent(candidate, this.props.items, Date.now());
    if (errors.length > 0) {
      this.setState({ errors });
      return;
    }
    this.props.onSave(candidate);
  };

  handleDelete = () => {
    this.props.onDelete(this.props.initialValues.id);
  };

  errorFor(field) {
    const error = this.state.errors.find(e => e.field === field);
    return error ? error.message : null;
  }

  render() {
    const { open, mode, groups, onClose } = this.props;
    if (!open) return null;

    const locked = this.isLockedOriginalEdit();

    return (
      <div className="event-form-overlay" onClick={onClose}>
        <div
          className="event-form"
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-form-title"
          onClick={e => e.stopPropagation()}
        >
          <h2 id="event-form-title">{mode === "add" ? "New event" : "Edit event"}</h2>

          {locked && (
            <p className="field-error field-error-banner">
              This event has started and can't be edited.
            </p>
          )}

          <form onSubmit={this.handleSubmit}>
            <label>
              Title
              <input
                ref={this.titleInputRef}
                type="text"
                value={this.state.title}
                onChange={this.handleChange("title")}
                disabled={locked}
              />
            </label>
            {this.errorFor("title") && <p className="field-error">{this.errorFor("title")}</p>}

            <label>
              Driver
              <select value={this.state.group} onChange={this.handleChange("group")} disabled={locked}>
                {groups.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.title} {group.rightTitle}
                  </option>
                ))}
              </select>
            </label>
            {this.errorFor("group") && <p className="field-error">{this.errorFor("group")}</p>}

            <label>
              Start
              <input
                type="datetime-local"
                value={this.state.start}
                onChange={this.handleChange("start")}
                disabled={locked}
              />
            </label>

            <label>
              End
              <input
                type="datetime-local"
                value={this.state.end}
                onChange={this.handleChange("end")}
                disabled={locked}
              />
            </label>
            {this.errorFor("duration") && (
              <p className="field-error">{this.errorFor("duration")}</p>
            )}
            {this.errorFor("start") && <p className="field-error">{this.errorFor("start")}</p>}
            {this.errorFor("locked") && (
              <p className="field-error">{this.errorFor("locked")}</p>
            )}
            {this.errorFor("overlap") && (
              <p className="field-error">{this.errorFor("overlap")}</p>
            )}

            <div className="event-form-actions">
              {mode === "edit" && (
                <button
                  type="button"
                  className="event-form-delete"
                  onClick={this.handleDelete}
                >
                  Delete
                </button>
              )}
              <button type="button" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" disabled={locked}>
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
}
