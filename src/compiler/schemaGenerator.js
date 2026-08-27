/**
 * src/compiler/schemaGenerator.js
 * Generates official XML Schema Definition (XSD) and JSON Schema for EUIX Engine (<uid_spec>).
 */

/**
 * Generates W3C XML Schema Definition (.xsd) string for EUIX Engine XML templates.
 * @returns {string} XML Schema string
 */
export function generateXSDSchema() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
           elementFormDefault="qualified"
           attributeFormDefault="unqualified"
           targetNamespace="http://euix.org/schema/uid_spec"
           xmlns="http://euix.org/schema/uid_spec">

  <!-- ================= ROOT ELEMENTS ================= -->
  <xs:element name="uid_spec" type="UidSpecType" />
  <xs:element name="component_def" type="ComponentDefType" />

  <!-- ================= UID SPEC TYPE ================= -->
  <xs:complexType name="UidSpecType">
    <xs:sequence>
      <xs:element name="head" type="HeadType" minOccurs="0" />
      <xs:element name="constants" type="ConstantsType" minOccurs="0" />
      <xs:element name="data_model" type="DataModelType" minOccurs="0" />
      <xs:element name="api_config" type="ApiConfigType" minOccurs="0" />
      <xs:element name="validation_rules" type="ValidationRulesType" minOccurs="0" />
      <xs:element name="actions" type="ActionsType" minOccurs="0" />
      <xs:element name="style" type="StyleType" minOccurs="0" maxOccurs="unbounded" />
      <!-- Top level lifecycle hooks and UI tree -->
      <xs:choice minOccurs="0" maxOccurs="unbounded">
        <xs:group ref="LifecycleHooksGroup" />
        <xs:group ref="UIElementsGroup" />
      </xs:choice>
    </xs:sequence>
    <xs:attribute name="version" type="xs:string" />
  </xs:complexType>

  <!-- ================= COMPONENT DEF TYPE ================= -->
  <xs:complexType name="ComponentDefType">
    <xs:complexContent>
      <xs:extension base="UidSpecType">
        <xs:attribute name="name" type="xs:string" use="required" />
        <xs:attribute name="isolated" type="xs:boolean" default="false" />
      </xs:extension>
    </xs:complexContent>
  </xs:complexType>

  <!-- ================= DATA MODEL & STATE ================= -->
  <xs:complexType name="DataModelType">
    <xs:sequence>
      <xs:element name="state" type="StateType" minOccurs="0" maxOccurs="unbounded" />
      <xs:element name="computed" type="ComputedType" minOccurs="0" maxOccurs="unbounded" />
      <xs:element name="watch" type="WatchType" minOccurs="0" maxOccurs="unbounded" />
    </xs:sequence>
    <xs:attribute name="scope" type="ScopeEnum" default="local" />
  </xs:complexType>

  <xs:complexType name="StateType" mixed="true">
    <xs:attribute name="id" type="xs:string" use="required" />
    <xs:attribute name="type" type="DataTypeEnum" default="string" />
    <xs:attribute name="scope" type="ScopeEnum" default="local" />
    <xs:attribute name="persist" type="xs:boolean" default="false" />
  </xs:complexType>

  <xs:simpleType name="DataTypeEnum">
    <xs:restriction base="xs:string">
      <xs:enumeration value="string" />
      <xs:enumeration value="number" />
      <xs:enumeration value="boolean" />
      <xs:enumeration value="array" />
      <xs:enumeration value="object" />
    </xs:restriction>
  </xs:simpleType>

  <xs:simpleType name="ScopeEnum">
    <xs:restriction base="xs:string">
      <xs:enumeration value="local" />
      <xs:enumeration value="global" />
    </xs:restriction>
  </xs:simpleType>

  <xs:complexType name="ComputedType" mixed="true">
    <xs:attribute name="id" type="xs:string" use="required" />
    <xs:attribute name="type" type="DataTypeEnum" />
  </xs:complexType>

  <xs:complexType name="WatchType">
    <xs:sequence minOccurs="0" maxOccurs="unbounded">
      <xs:group ref="ActionStepsGroup" />
    </xs:sequence>
    <xs:attribute name="key" type="xs:string" use="required" />
    <xs:attribute name="action" type="xs:string" />
  </xs:complexType>

  <xs:complexType name="ConstantsType">
    <xs:sequence minOccurs="0" maxOccurs="unbounded">
      <xs:any processContents="lax" />
    </xs:sequence>
  </xs:complexType>

  <!-- ================= REST API & STREAMING ================= -->
  <xs:complexType name="ApiConfigType">
    <xs:sequence>
      <xs:element name="api_endpoint" type="ApiEndpointType" minOccurs="0" maxOccurs="unbounded" />
      <xs:element name="api_stream" type="ApiStreamType" minOccurs="0" maxOccurs="unbounded" />
      <xs:element name="websocket" type="ApiStreamType" minOccurs="0" maxOccurs="unbounded" />
      <xs:element name="sse" type="ApiStreamType" minOccurs="0" maxOccurs="unbounded" />
    </xs:sequence>
    <xs:attribute name="base_url" type="xs:string" />
    <xs:attribute name="retry" type="xs:integer" />
    <xs:attribute name="timeout" type="xs:integer" />
  </xs:complexType>

  <xs:complexType name="ApiEndpointType" mixed="true">
    <xs:sequence>
      <xs:element name="headers" type="xs:string" minOccurs="0" />
      <xs:element name="body" type="xs:string" minOccurs="0" />
    </xs:sequence>
    <xs:attribute name="id" type="xs:string" />
    <xs:attribute name="tag" type="xs:string" />
    <xs:attribute name="url" type="xs:string" use="required" />
    <xs:attribute name="method" type="HttpMethodEnum" default="GET" />
    <xs:attribute name="target" type="xs:string" />
    <xs:attribute name="bind_target" type="xs:string" />
    <xs:attribute name="auto_fetch" type="xs:boolean" default="true" />
    <xs:attribute name="revalidate_focus" type="xs:boolean" default="false" />
    <xs:attribute name="revalidate_online" type="xs:boolean" default="true" />
    <xs:attribute name="persist" type="PersistStorageEnum" />
    <xs:attribute name="queue_offline" type="xs:boolean" default="false" />
    <xs:attribute name="loading" type="xs:string" />
    <xs:attribute name="error" type="xs:string" />
    <xs:attribute name="select" type="xs:string" />
  </xs:complexType>

  <xs:simpleType name="HttpMethodEnum">
    <xs:restriction base="xs:string">
      <xs:enumeration value="GET" />
      <xs:enumeration value="POST" />
      <xs:enumeration value="PUT" />
      <xs:enumeration value="DELETE" />
      <xs:enumeration value="PATCH" />
      <xs:enumeration value="HEAD" />
    </xs:restriction>
  </xs:simpleType>

  <xs:simpleType name="PersistStorageEnum">
    <xs:restriction base="xs:string">
      <xs:enumeration value="localStorage" />
      <xs:enumeration value="sessionStorage" />
    </xs:restriction>
  </xs:simpleType>

  <xs:complexType name="ApiStreamType">
    <xs:attribute name="id" type="xs:string" use="required" />
    <xs:attribute name="url" type="xs:string" use="required" />
    <xs:attribute name="type" type="StreamTypeEnum" default="ws" />
    <xs:attribute name="target" type="xs:string" />
    <xs:attribute name="operation" type="StreamOpEnum" default="REPLACE" />
    <xs:attribute name="event_name" type="xs:string" />
    <xs:attribute name="auto_connect" type="xs:boolean" default="true" />
    <xs:attribute name="reconnect" type="xs:boolean" default="true" />
    <xs:attribute name="reconnect_interval" type="xs:integer" default="3000" />
    <xs:attribute name="reconnect_attempts" type="xs:integer" default="10" />
  </xs:complexType>

  <xs:simpleType name="StreamTypeEnum">
    <xs:restriction base="xs:string">
      <xs:enumeration value="ws" />
      <xs:enumeration value="websocket" />
      <xs:enumeration value="sse" />
      <xs:enumeration value="eventsource" />
    </xs:restriction>
  </xs:simpleType>

  <xs:simpleType name="StreamOpEnum">
    <xs:restriction base="xs:string">
      <xs:enumeration value="REPLACE" />
      <xs:enumeration value="PUSH" />
      <xs:enumeration value="UNSHIFT" />
    </xs:restriction>
  </xs:simpleType>

  <!-- ================= FORM VALIDATION ================= -->
  <xs:complexType name="ValidationRulesType">
    <xs:sequence>
      <xs:element name="field" type="ValidationFieldType" minOccurs="0" maxOccurs="unbounded" />
    </xs:sequence>
  </xs:complexType>

  <xs:complexType name="ValidationFieldType">
    <xs:attribute name="id" type="xs:string" use="required" />
    <xs:attribute name="required" type="xs:boolean" default="false" />
    <xs:attribute name="min_length" type="xs:integer" />
    <xs:attribute name="max_length" type="xs:integer" />
    <xs:attribute name="min" type="xs:decimal" />
    <xs:attribute name="max" type="xs:decimal" />
    <xs:attribute name="pattern" type="xs:string" />
    <xs:attribute name="email" type="xs:boolean" />
    <xs:attribute name="url" type="xs:boolean" />
    <xs:attribute name="validator" type="xs:string" />
    <xs:attribute name="message" type="xs:string" />
  </xs:complexType>

  <!-- ================= ACTION WORKFLOWS ================= -->
  <xs:complexType name="ActionsType">
    <xs:sequence>
      <xs:element name="action_def" type="ActionDefType" minOccurs="0" maxOccurs="unbounded" />
    </xs:sequence>
  </xs:complexType>

  <xs:complexType name="ActionDefType">
    <xs:sequence>
      <xs:element name="param" type="ActionParamType" minOccurs="0" maxOccurs="unbounded" />
      <xs:choice minOccurs="0" maxOccurs="unbounded">
        <xs:element name="step" type="ActionStepType" />
        <xs:group ref="ActionStepsGroup" />
      </xs:choice>
      <xs:element name="return" type="xs:string" minOccurs="0" />
    </xs:sequence>
    <xs:attribute name="name" type="xs:string" use="required" />
  </xs:complexType>

  <xs:complexType name="ActionParamType">
    <xs:attribute name="name" type="xs:string" use="required" />
    <xs:attribute name="type" type="DataTypeEnum" />
    <xs:attribute name="default" type="xs:string" />
    <xs:attribute name="required" type="xs:boolean" default="false" />
  </xs:complexType>

  <xs:complexType name="ActionStepType" mixed="true">
    <xs:sequence minOccurs="0" maxOccurs="unbounded">
      <xs:element name="path" type="xs:string" minOccurs="0" />
      <xs:element name="value" type="xs:string" minOccurs="0" />
      <xs:element name="operation" type="xs:string" minOccurs="0" />
      <xs:element name="arg" type="ActionArgType" minOccurs="0" maxOccurs="unbounded" />
    </xs:sequence>
    <xs:attribute name="action" type="xs:string" />
    <xs:attribute name="path" type="xs:string" />
    <xs:attribute name="value" type="xs:string" />
    <xs:attribute name="operation" type="xs:string" />
    <xs:attribute name="tag" type="xs:string" />
  </xs:complexType>

  <xs:complexType name="ActionArgType" mixed="true">
    <xs:attribute name="name" type="xs:string" use="required" />
    <xs:attribute name="value" type="xs:string" />
  </xs:complexType>

  <!-- ================= ACTION STEPS GROUP ================= -->
  <xs:group name="ActionStepsGroup">
    <xs:choice>
      <xs:element name="set_state" type="ActionStepType" />
      <xs:element name="mutate_state" type="ActionStepType" />
      <xs:element name="toggle_state" type="ActionStepType" />
      <xs:element name="revalidate_api" type="ActionStepType" />
      <xs:element name="run_script" type="ActionStepType" />
      <xs:element name="validate_form" type="ActionStepType" />
      <xs:element name="reset_validation" type="ActionStepType" />
      <xs:element name="stream_send" type="ActionStepType" />
      <xs:element name="stream_connect" type="ActionStepType" />
      <xs:element name="stream_disconnect" type="ActionStepType" />
      <xs:element name="undo_state" type="ActionStepType" />
      <xs:element name="redo_state" type="ActionStepType" />
      <xs:element name="take_snapshot" type="ActionStepType" />
      <xs:element name="announce" type="ActionStepType" />
      <xs:element name="try" type="TryBlockType" />
    </xs:choice>
  </xs:group>

  <xs:complexType name="TryBlockType">
    <xs:sequence>
      <xs:choice minOccurs="0" maxOccurs="unbounded">
        <xs:group ref="ActionStepsGroup" />
      </xs:choice>
      <xs:element name="catch" type="CatchBlockType" minOccurs="0" />
      <xs:element name="finally" type="FinallyBlockType" minOccurs="0" />
    </xs:sequence>
  </xs:complexType>

  <xs:complexType name="CatchBlockType">
    <xs:sequence minOccurs="0" maxOccurs="unbounded">
      <xs:group ref="ActionStepsGroup" />
    </xs:sequence>
    <xs:attribute name="error" type="xs:string" />
  </xs:complexType>

  <xs:complexType name="FinallyBlockType">
    <xs:sequence minOccurs="0" maxOccurs="unbounded">
      <xs:group ref="ActionStepsGroup" />
    </xs:sequence>
  </xs:complexType>

  <!-- ================= LIFECYCLE HOOKS ================= -->
  <xs:group name="LifecycleHooksGroup">
    <xs:choice>
      <xs:element name="on_mount" type="LifecycleEventType" />
      <xs:element name="on_unmount" type="LifecycleEventType" />
      <xs:element name="on_interval" type="IntervalEventType" />
      <xs:element name="on_state_change" type="StateChangeEventType" />
    </xs:choice>
  </xs:group>

  <xs:complexType name="LifecycleEventType" mixed="true">
    <xs:sequence minOccurs="0" maxOccurs="unbounded">
      <xs:group ref="ActionStepsGroup" />
    </xs:sequence>
    <xs:attribute name="action" type="xs:string" />
  </xs:complexType>

  <xs:complexType name="IntervalEventType" mixed="true">
    <xs:complexContent>
      <xs:extension base="LifecycleEventType">
        <xs:attribute name="ms" type="xs:integer" use="required" />
      </xs:extension>
    </xs:complexContent>
  </xs:complexType>

  <xs:complexType name="StateChangeEventType" mixed="true">
    <xs:complexContent>
      <xs:extension base="LifecycleEventType">
        <xs:attribute name="key" type="xs:string" use="required" />
      </xs:extension>
    </xs:complexContent>
  </xs:complexType>

  <!-- ================= UI ELEMENTS & LAYOUT ================= -->
  <xs:group name="UIElementsGroup">
    <xs:choice>
      <xs:element name="flex" type="FlexType" />
      <xs:element name="grid" type="GridType" />
      <xs:element name="container" type="GenericContainerType" />
      <xs:element name="card" type="GenericContainerType" />
      <xs:element name="dialog" type="DialogType" />
      <xs:element name="collapse" type="CollapseType" />
      <xs:element name="live_region" type="LiveRegionType" />
      <xs:element name="for_each" type="ForEachType" />
      <xs:element name="if" type="ConditionalType" />
      <xs:element name="component" type="ComponentUsageType" />
      <xs:element name="slot" type="SlotType" />
      <xs:element name="children" type="SlotType" />
      <!-- Standard HTML Elements -->
      <xs:element name="div" type="GenericContainerType" />
      <xs:element name="span" type="GenericContainerType" />
      <xs:element name="p" type="GenericContainerType" />
      <xs:element name="h1" type="GenericContainerType" />
      <xs:element name="h2" type="GenericContainerType" />
      <xs:element name="h3" type="GenericContainerType" />
      <xs:element name="h4" type="GenericContainerType" />
      <xs:element name="h5" type="GenericContainerType" />
      <xs:element name="h6" type="GenericContainerType" />
      <xs:element name="button" type="ButtonType" />
      <xs:element name="input" type="InputType" />
      <xs:element name="textarea" type="TextareaType" />
      <xs:element name="select" type="SelectType" />
      <xs:element name="option" type="OptionType" />
      <xs:element name="form" type="FormType" />
      <xs:element name="img" type="ImgType" />
      <xs:element name="a" type="AnchorType" />
      <xs:element name="ul" type="GenericContainerType" />
      <xs:element name="ol" type="GenericContainerType" />
      <xs:element name="li" type="GenericContainerType" />
      <xs:element name="table" type="GenericContainerType" />
      <xs:element name="thead" type="GenericContainerType" />
      <xs:element name="tbody" type="GenericContainerType" />
      <xs:element name="tr" type="GenericContainerType" />
      <xs:element name="th" type="GenericContainerType" />
      <xs:element name="td" type="GenericContainerType" />
    </xs:choice>
  </xs:group>

  <!-- Generic Base Element Attributes -->
  <xs:attributeGroup name="CommonUIAttributes">
    <xs:attribute name="id" type="xs:string" />
    <xs:attribute name="class" type="xs:string" />
    <xs:attribute name="style" type="xs:string" />
    <xs:attribute name="bind" type="xs:string" />
    <xs:attribute name="ref" type="xs:string" />
    <xs:attribute name="hidden" type="xs:string" />
    <xs:attribute name="title" type="xs:string" />
    <xs:attribute name="role" type="xs:string" />
    <xs:attribute name="aria-label" type="xs:string" />
    <xs:attribute name="aria-hidden" type="xs:string" />
    <xs:anyAttribute processContents="lax" />
  </xs:attributeGroup>

  <xs:complexType name="GenericContainerType" mixed="true">
    <xs:sequence minOccurs="0" maxOccurs="unbounded">
      <xs:group ref="EventHandlersGroup" minOccurs="0" maxOccurs="unbounded" />
      <xs:group ref="UIElementsGroup" minOccurs="0" maxOccurs="unbounded" />
    </xs:sequence>
    <xs:attributeGroup ref="CommonUIAttributes" />
  </xs:complexType>

  <xs:complexType name="FlexType" mixed="true">
    <xs:complexContent>
      <xs:extension base="GenericContainerType">
        <xs:attribute name="direction" type="FlexDirectionEnum" default="row" />
        <xs:attribute name="gap" type="xs:string" />
        <xs:attribute name="align" type="xs:string" />
        <xs:attribute name="justify" type="xs:string" />
        <xs:attribute name="wrap" type="xs:string" />
      </xs:extension>
    </xs:complexContent>
  </xs:complexType>

  <xs:simpleType name="FlexDirectionEnum">
    <xs:restriction base="xs:string">
      <xs:enumeration value="row" />
      <xs:enumeration value="column" />
      <xs:enumeration value="row-reverse" />
      <xs:enumeration value="column-reverse" />
    </xs:restriction>
  </xs:simpleType>

  <xs:complexType name="GridType" mixed="true">
    <xs:complexContent>
      <xs:extension base="GenericContainerType">
        <xs:attribute name="columns" type="xs:string" />
        <xs:attribute name="rows" type="xs:string" />
        <xs:attribute name="gap" type="xs:string" />
      </xs:extension>
    </xs:complexContent>
  </xs:complexType>

  <xs:complexType name="DialogType" mixed="true">
    <xs:sequence>
      <xs:element name="summary" type="xs:string" minOccurs="0" />
      <xs:element name="description" type="xs:string" minOccurs="0" />
      <xs:choice minOccurs="0" maxOccurs="unbounded">
        <xs:group ref="UIElementsGroup" />
      </xs:choice>
      <xs:element name="actions" type="GenericContainerType" minOccurs="0" />
    </xs:sequence>
    <xs:attributeGroup ref="CommonUIAttributes" />
    <xs:attribute name="show" type="xs:string" />
    <xs:attribute name="open" type="xs:string" />
    <xs:attribute name="is_open" type="xs:string" />
    <xs:attribute name="close_on_backdrop" type="xs:boolean" default="true" />
    <xs:attribute name="lock_scroll" type="xs:boolean" default="true" />
    <xs:attribute name="initial_focus" type="xs:string" />
    <xs:attribute name="close_label" type="xs:string" />
    <xs:attribute name="panel_class" type="xs:string" />
    <xs:attribute name="backdrop_class" type="xs:string" />
    <xs:attribute name="header_class" type="xs:string" />
    <xs:attribute name="body_class" type="xs:string" />
    <xs:attribute name="footer_class" type="xs:string" />
  </xs:complexType>

  <xs:complexType name="CollapseType" mixed="true">
    <xs:sequence>
      <xs:element name="summary" type="xs:string" minOccurs="0" />
      <xs:choice minOccurs="0" maxOccurs="unbounded">
        <xs:group ref="UIElementsGroup" />
      </xs:choice>
    </xs:sequence>
    <xs:attributeGroup ref="CommonUIAttributes" />
    <xs:attribute name="group" type="xs:string" />
    <xs:attribute name="name" type="xs:string" />
    <xs:attribute name="header_class" type="xs:string" />
    <xs:attribute name="body_class" type="xs:string" />
  </xs:complexType>

  <xs:complexType name="LiveRegionType" mixed="true">
    <xs:attributeGroup ref="CommonUIAttributes" />
    <xs:attribute name="priority" type="LivePriorityEnum" default="polite" />
    <xs:attribute name="aria-live" type="LivePriorityEnum" default="polite" />
  </xs:complexType>

  <xs:simpleType name="LivePriorityEnum">
    <xs:restriction base="xs:string">
      <xs:enumeration value="polite" />
      <xs:enumeration value="assertive" />
      <xs:enumeration value="off" />
    </xs:restriction>
  </xs:simpleType>

  <xs:complexType name="ForEachType">
    <xs:sequence minOccurs="0" maxOccurs="unbounded">
      <xs:group ref="UIElementsGroup" />
    </xs:sequence>
    <xs:attribute name="items" type="xs:string" use="required" />
    <xs:attribute name="var" type="xs:string" default="item" />
    <xs:attribute name="index" type="xs:string" default="index" />
    <xs:attribute name="key" type="xs:string" />
    <xs:attribute name="virtual" type="xs:boolean" default="false" />
    <xs:attribute name="item_height" type="xs:integer" />
  </xs:complexType>

  <xs:complexType name="ConditionalType">
    <xs:sequence>
      <xs:choice minOccurs="0" maxOccurs="unbounded">
        <xs:group ref="UIElementsGroup" />
      </xs:choice>
      <xs:element name="else" type="GenericContainerType" minOccurs="0" />
    </xs:sequence>
    <xs:attribute name="condition" type="xs:string" use="required" />
  </xs:complexType>

  <xs:complexType name="ComponentUsageType">
    <xs:sequence minOccurs="0" maxOccurs="unbounded">
      <xs:group ref="UIElementsGroup" />
    </xs:sequence>
    <xs:attribute name="name" type="xs:string" />
    <xs:attribute name="src" type="xs:string" />
    <xs:anyAttribute processContents="lax" />
  </xs:complexType>

  <xs:complexType name="SlotType">
    <xs:attribute name="name" type="xs:string" />
  </xs:complexType>

  <xs:complexType name="ButtonType" mixed="true">
    <xs:complexContent>
      <xs:extension base="GenericContainerType">
        <xs:attribute name="type" type="xs:string" default="button" />
        <xs:attribute name="disabled" type="xs:string" />
      </xs:extension>
    </xs:complexContent>
  </xs:complexType>

  <xs:complexType name="InputType">
    <xs:sequence minOccurs="0" maxOccurs="unbounded">
      <xs:group ref="EventHandlersGroup" />
    </xs:sequence>
    <xs:attributeGroup ref="CommonUIAttributes" />
    <xs:attribute name="type" type="xs:string" default="text" />
    <xs:attribute name="placeholder" type="xs:string" />
    <xs:attribute name="value" type="xs:string" />
    <xs:attribute name="disabled" type="xs:string" />
    <xs:attribute name="readonly" type="xs:string" />
    <xs:attribute name="checked" type="xs:string" />
  </xs:complexType>

  <xs:complexType name="TextareaType" mixed="true">
    <xs:sequence minOccurs="0" maxOccurs="unbounded">
      <xs:group ref="EventHandlersGroup" />
    </xs:sequence>
    <xs:attributeGroup ref="CommonUIAttributes" />
    <xs:attribute name="placeholder" type="xs:string" />
    <xs:attribute name="rows" type="xs:integer" />
    <xs:attribute name="cols" type="xs:integer" />
  </xs:complexType>

  <xs:complexType name="SelectType">
    <xs:sequence>
      <xs:group ref="EventHandlersGroup" minOccurs="0" maxOccurs="unbounded" />
      <xs:element name="option" type="OptionType" minOccurs="0" maxOccurs="unbounded" />
    </xs:sequence>
    <xs:attributeGroup ref="CommonUIAttributes" />
  </xs:complexType>

  <xs:complexType name="OptionType" mixed="true">
    <xs:attribute name="value" type="xs:string" />
    <xs:attribute name="selected" type="xs:string" />
  </xs:complexType>

  <xs:complexType name="FormType" mixed="true">
    <xs:complexContent>
      <xs:extension base="GenericContainerType">
        <xs:attribute name="action" type="xs:string" />
        <xs:attribute name="method" type="xs:string" />
      </xs:extension>
    </xs:complexContent>
  </xs:complexType>

  <xs:complexType name="ImgType">
    <xs:attributeGroup ref="CommonUIAttributes" />
    <xs:attribute name="src" type="xs:string" use="required" />
    <xs:attribute name="alt" type="xs:string" />
    <xs:attribute name="width" type="xs:string" />
    <xs:attribute name="height" type="xs:string" />
  </xs:complexType>

  <xs:complexType name="AnchorType" mixed="true">
    <xs:complexContent>
      <xs:extension base="GenericContainerType">
        <xs:attribute name="href" type="xs:string" use="required" />
        <xs:attribute name="target" type="xs:string" />
      </xs:extension>
    </xs:complexContent>
  </xs:complexType>

  <!-- ================= EVENT HANDLERS ================= -->
  <xs:group name="EventHandlersGroup">
    <xs:choice>
      <xs:element name="on_click" type="EventHandlerType" />
      <xs:element name="on_change" type="EventHandlerType" />
      <xs:element name="on_submit" type="EventHandlerType" />
      <xs:element name="on_keyup" type="EventHandlerType" />
      <xs:element name="on_keydown" type="EventHandlerType" />
      <xs:element name="on_mouseenter" type="EventHandlerType" />
      <xs:element name="on_mouseleave" type="EventHandlerType" />
      <xs:element name="event" type="GenericEventType" />
    </xs:choice>
  </xs:group>

  <xs:complexType name="EventHandlerType" mixed="true">
    <xs:sequence minOccurs="0" maxOccurs="unbounded">
      <xs:element name="path" type="xs:string" minOccurs="0" />
      <xs:element name="value" type="xs:string" minOccurs="0" />
      <xs:element name="operation" type="xs:string" minOccurs="0" />
      <xs:element name="arg" type="ActionArgType" minOccurs="0" maxOccurs="unbounded" />
      <xs:element name="confirm" type="ConfirmType" minOccurs="0" />
      <xs:group ref="ActionStepsGroup" minOccurs="0" maxOccurs="unbounded" />
    </xs:sequence>
    <xs:attribute name="action" type="xs:string" />
    <xs:attribute name="prevent_default" type="xs:boolean" default="false" />
    <xs:attribute name="stop_propagation" type="xs:boolean" default="false" />
    <xs:attribute name="confirm" type="xs:string" />
    <xs:attribute name="tag" type="xs:string" />
    <xs:attribute name="path" type="xs:string" />
    <xs:attribute name="value" type="xs:string" />
    <xs:attribute name="operation" type="xs:string" />
  </xs:complexType>

  <xs:complexType name="GenericEventType" mixed="true">
    <xs:complexContent>
      <xs:extension base="EventHandlerType">
        <xs:attribute name="type" type="xs:string" use="required" />
      </xs:extension>
    </xs:complexContent>
  </xs:complexType>

  <xs:complexType name="ConfirmType" mixed="true">
    <xs:attribute name="condition" type="xs:string" />
  </xs:complexType>

  <!-- ================= HEAD & STYLES ================= -->
  <xs:complexType name="HeadType">
    <xs:sequence minOccurs="0" maxOccurs="unbounded">
      <xs:any processContents="lax" />
    </xs:sequence>
  </xs:complexType>

  <xs:complexType name="StyleType" mixed="true">
    <xs:attribute name="scoped" type="xs:boolean" default="false" />
    <xs:attribute name="src" type="xs:string" />
  </xs:complexType>

</xs:schema>
`;
}

/**
 * Generates JSON Schema representation for EUIX Engine specification tree.
 * @returns {object} JSON Schema object
 */
export function generateJsonSchema() {
    return {
        $schema: "http://json-schema.org/draft-07/schema#",
        title: "EUIX XML UI Specification Schema",
        description: "JSON Schema validator for EUIX Engine declarative XML components and applications",
        type: "object",
        properties: {
            uid_spec: {
                type: "object",
                properties: {
                    data_model: {
                        type: "object",
                        properties: {
                            state: {
                                type: "array",
                                items: {
                                    type: "object",
                                    required: ["id"],
                                    properties: {
                                        id: { type: "string" },
                                        type: { enum: ["string", "number", "boolean", "array", "object"] },
                                        scope: { enum: ["local", "global"] },
                                        persist: { type: "boolean" },
                                    },
                                },
                            },
                        },
                    },
                    api_config: {
                        type: "object",
                        properties: {
                            base_url: { type: "string" },
                            api_endpoint: {
                                type: "array",
                                items: {
                                    type: "object",
                                    required: ["url"],
                                    properties: {
                                        id: { type: "string" },
                                        url: { type: "string" },
                                        method: { enum: ["GET", "POST", "PUT", "DELETE", "PATCH"] },
                                        target: { type: "string" },
                                        auto_fetch: { type: "boolean" },
                                        persist: { enum: ["localStorage", "sessionStorage"] },
                                        queue_offline: { type: "boolean" },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    };
}
