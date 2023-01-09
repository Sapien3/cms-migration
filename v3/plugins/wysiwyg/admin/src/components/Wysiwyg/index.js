import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { isEmpty } from 'lodash';
import { Button } from '@buffetjs/core';
import { Label, InputDescription, InputErrors } from 'strapi-helper-plugin';
// import Editor from '../CKEditor';
import Editor from '../ToastUI';
import MediaLib from '../MediaLib';

const Wysiwyg = ({
  inputDescription,
  errors,
  label,
  name,
  noErrorsDescription,
  onChange,
  value,
}) => {
  const editorRef = React.createRef();
  const [isOpen, setIsOpen] = useState(false);
  let spacer = !isEmpty(inputDescription) ? <div style={{ height: '.4rem' }} /> : <div />;

  if (!noErrorsDescription && !isEmpty(errors)) {
    spacer = <div />;
  }

  const handleMediaChange = data => {
    // console.log('handleMediaChange', data);
    if (data.mime.includes('image')) {
      // const imgTag = `<p><img src="${data.url}" caption="${data.caption}" alt="${data.alternativeText}"></img></p>`;
      // const newValue = value ? `${value}${imgTag}` : imgTag;
      const rawValue = `![${data.alternativeText}](${data.url})`;
      const newValue = value ? `${value}\n${rawValue}\n` : rawValue;
      console.log(`${name} inserted`, editorRef, newValue);
      onChange({ target: { name, value: newValue } });
      editorRef.current.replaceValue(newValue);
    }

    // Handle videos and other type of files by adding some code
  };
  const handleCKMediaChange = data => {
    console.log()
    if (data.mime.includes('image')) {
      const imgTag = `<p><img src="${data.url}" caption="${data.caption}" alt="${data.alternativeText}"></img></p>`;
      const newValue = value ? `${value}${imgTag}` : imgTag;

      onChange({ target: { name, value: newValue } });
    }

    // Handle videos and other type of files by adding some code
  };

  const handleToggle = () => setIsOpen(prev => !prev);
  return (
    <div
      style={{
        marginBottom: '1.6rem',
        fontSize: '1.3rem',
        fontFamily: 'Lato',
      }}
    >
      <Label htmlFor={name} message={label} style={{ marginBottom: 10 }} />
      <div>
        <Button color="primary" onClick={handleToggle}>
          Gallery
        </Button>
      </div>
      <Editor
        name={name} onChange={onChange} value={value} height="400px" ref={editorRef}
      />
      <InputDescription
        message={inputDescription}
        style={!isEmpty(inputDescription) ? { marginTop: '1.4rem' } : {}}
      />
      <InputErrors errors={(!noErrorsDescription && errors) || []} name={name} />
      {spacer}
      <MediaLib onToggle={handleToggle} isOpen={isOpen} onChange={handleMediaChange} />
    </div>
  );
};
//<Editor name={name} onChange={onChange} value={value} />

Wysiwyg.defaultProps = {
  errors: [],
  inputDescription: null,
  label: '',
  noErrorsDescription: false,
  value: '',
};

Wysiwyg.propTypes = {
  errors: PropTypes.array,
  inputDescription: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.func,
    PropTypes.shape({
      id: PropTypes.string,
      params: PropTypes.object,
    }),
  ]),
  label: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.func,
    PropTypes.shape({
      id: PropTypes.string,
      params: PropTypes.object,
    }),
  ]),
  name: PropTypes.string.isRequired,
  noErrorsDescription: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.string,
};

export default Wysiwyg;
