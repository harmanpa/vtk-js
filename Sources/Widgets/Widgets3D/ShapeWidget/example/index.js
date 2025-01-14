import 'vtk.js/Sources/favicon';

// Load the rendering pieces we want to use (for both WebGL and WebGPU)
import 'vtk.js/Sources/Rendering/Profiles/All';

import vtkFullScreenRenderWindow from 'vtk.js/Sources/Rendering/Misc/FullScreenRenderWindow';
import vtkWidgetManager from 'vtk.js/Sources/Widgets/Core/WidgetManager';
import vtkRectangleWidget from 'vtk.js/Sources/Widgets/Widgets3D/RectangleWidget';
import vtkEllipseWidget from 'vtk.js/Sources/Widgets/Widgets3D/EllipseWidget';
import vtkInteractorStyleImage from 'vtk.js/Sources/Interaction/Style/InteractorStyleImage';
import vtkHttpDataSetReader from 'vtk.js/Sources/IO/Core/HttpDataSetReader';
import vtkImageMapper from 'vtk.js/Sources/Rendering/Core/ImageMapper';
import vtkImageSlice from 'vtk.js/Sources/Rendering/Core/ImageSlice';
import vtkSphere from 'vtk.js/Sources/Common/DataModel/Sphere';
import vtkBoundingBox from 'vtk.js/Sources/Common/DataModel/BoundingBox';

import {
  BehaviorCategory,
  ShapeBehavior,
  HorizontalTextPosition,
  VerticalTextPosition,
  computeTextPosition,
} from 'vtk.js/Sources/Widgets/Widgets3D/ShapeWidget/Constants';
import {
  TextAlign,
  VerticalAlign,
} from 'vtk.js/Sources/Interaction/Widgets/LabelRepresentation/Constants';

import { ViewTypes } from 'vtk.js/Sources/Widgets/Core/WidgetManager/Constants';

import { vec3 } from 'gl-matrix';

import controlPanel from './controlPanel.html';

// ----------------------------------------------------------------------------
// Standard rendering code setup
// ----------------------------------------------------------------------------

// scene
const scene = {};

scene.fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
  rootContainer: document.body,
  background: [0.1, 0.1, 0.1],
});

scene.renderer = scene.fullScreenRenderer.getRenderer();
scene.renderWindow = scene.fullScreenRenderer.getRenderWindow();
scene.openGLRenderWindow =
  scene.fullScreenRenderer.getApiSpecificRenderWindow();
scene.camera = scene.renderer.getActiveCamera();

// setup 2D view
scene.camera.setParallelProjection(true);
scene.iStyle = vtkInteractorStyleImage.newInstance();
scene.iStyle.setInteractionMode('IMAGE_SLICING');
scene.renderWindow.getInteractor().setInteractorStyle(scene.iStyle);
scene.fullScreenRenderer.addController(controlPanel);

function setCamera(sliceMode, renderer, data) {
  const ijk = [0, 0, 0];
  const position = [0, 0, 0];
  const focalPoint = [0, 0, 0];
  data.indexToWorld(ijk, focalPoint);
  ijk[sliceMode] = 1;
  data.indexToWorld(ijk, position);
  renderer.getActiveCamera().set({ focalPoint, position });
  renderer.resetCamera();
}

// ----------------------------------------------------------------------------
// Widget manager
// ----------------------------------------------------------------------------

scene.widgetManager = vtkWidgetManager.newInstance();
scene.widgetManager.setRenderer(scene.renderer);

// Widgets
const widgets = {};
widgets.rectangleWidget = vtkRectangleWidget.newInstance({
  resetAfterPointPlacement: false,
  useHandles: true,
});
widgets.ellipseWidget = vtkEllipseWidget.newInstance({
  modifierBehavior: {
    None: {
      [BehaviorCategory.PLACEMENT]:
        ShapeBehavior[BehaviorCategory.PLACEMENT].CLICK_AND_DRAG,
      [BehaviorCategory.POINTS]:
        ShapeBehavior[BehaviorCategory.POINTS].CORNER_TO_CORNER,
      [BehaviorCategory.RATIO]: ShapeBehavior[BehaviorCategory.RATIO].FREE,
    },
  },
  resetAfterPointPlacement: false,
  useHandles: true,
});
widgets.circleWidget = vtkEllipseWidget.newInstance({
  modifierBehavior: {
    None: {
      [BehaviorCategory.PLACEMENT]:
        ShapeBehavior[BehaviorCategory.PLACEMENT].CLICK_AND_DRAG,
      [BehaviorCategory.POINTS]: ShapeBehavior[BehaviorCategory.POINTS].RADIUS,
      [BehaviorCategory.RATIO]: ShapeBehavior[BehaviorCategory.RATIO].FREE,
    },
  },
  resetAfterPointPlacement: false,
  useHandles: true,
});

scene.rectangleHandle = scene.widgetManager.addWidget(
  widgets.rectangleWidget,
  ViewTypes.SLICE
);
scene.ellipseHandle = scene.widgetManager.addWidget(
  widgets.ellipseWidget,
  ViewTypes.SLICE
);
scene.circleHandle = scene.widgetManager.addWidget(
  widgets.circleWidget,
  ViewTypes.SLICE
);

scene.widgetManager.grabFocus(widgets.ellipseWidget);
let activeWidget = 'ellipseWidget';

// ----------------------------------------------------------------------------
// Ready logic
// ----------------------------------------------------------------------------

function ready(scope, picking = false) {
  scope.renderer.resetCamera();
  scope.fullScreenRenderer.resize();
  if (picking) {
    scope.widgetManager.enablePicking();
  } else {
    scope.widgetManager.disablePicking();
  }
}

function readyAll() {
  ready(scene, true);
}

function updateControlPanel(im, ds) {
  const slicingMode = im.getSlicingMode();
  const extent = ds.getExtent();
  document.querySelector('.slice').setAttribute('min', extent[slicingMode * 2]);
  document
    .querySelector('.slice')
    .setAttribute('max', extent[slicingMode * 2 + 1]);
}

// ----------------------------------------------------------------------------
// Load image
// ----------------------------------------------------------------------------

const image = {
  imageMapper: vtkImageMapper.newInstance(),
  actor: vtkImageSlice.newInstance(),
};

// background image pipeline
image.actor.setMapper(image.imageMapper);

const reader = vtkHttpDataSetReader.newInstance({ fetchGzip: true });
reader
  .setUrl(`${__BASE_PATH__}/data/volume/LIDC2.vti`, { loadData: true })
  .then(() => {
    const data = reader.getOutputData();
    image.data = data;

    // set input data
    image.imageMapper.setInputData(data);

    // add actors to renderers
    scene.renderer.addViewProp(image.actor);
    // default slice orientation/mode and camera view
    const sliceMode = vtkImageMapper.SlicingMode.K;
    image.imageMapper.setSlicingMode(sliceMode);
    image.imageMapper.setSlice(0);

    // set 2D camera position
    setCamera(sliceMode, scene.renderer, image.data);

    updateControlPanel(image.imageMapper, data);

    scene.rectangleHandle.getRepresentations()[1].setDrawBorder(true);
    scene.rectangleHandle.getRepresentations()[1].setDrawFace(false);
    scene.rectangleHandle.getRepresentations()[1].setOpacity(1);
    scene.circleHandle.getRepresentations()[1].setDrawBorder(true);
    scene.circleHandle.getRepresentations()[1].setDrawFace(false);
    scene.circleHandle.getRepresentations()[1].setOpacity(1);
    scene.ellipseHandle.getRepresentations()[1].setDrawBorder(true);
    scene.ellipseHandle.getRepresentations()[1].setDrawFace(false);
    scene.ellipseHandle.getRepresentations()[1].setOpacity(1);

    scene.rectangleHandle.updateHandlesSize();
    scene.circleHandle.updateHandlesSize();
    scene.ellipseHandle.updateHandlesSize();

    // set text display callback
    scene.ellipseHandle.setLabelTextCallback(
      (worldBounds, screenBounds, labelRep) => {
        const { average, minimum, maximum } = image.data.computeHistogram(
          worldBounds,
          vtkSphere.isPointIn3DEllipse
        );

        const text = `average: ${average.toFixed(
          0
        )} \nmin: ${minimum} \nmax: ${maximum} `;

        const { width, height } = labelRep.computeTextDimensions(text);
        labelRep.setDisplayPosition(
          computeTextPosition(
            screenBounds,
            HorizontalTextPosition.OUTSIDE_RIGHT,
            VerticalTextPosition.INSIDE_TOP,
            width,
            height
          )
        );

        labelRep.setLabelText(text);
      }
    );

    scene.circleHandle.setLabelTextCallback(
      (worldBounds, screenBounds, labelRep) => {
        const center = vtkBoundingBox.getCenter(screenBounds);
        const radius =
          vec3.distance(center, [
            screenBounds[0],
            screenBounds[2],
            screenBounds[4],
          ]) / 2;

        const position = [0, 0, 0];
        vec3.scaleAndAdd(position, center, [1, 1, 1], radius);
        labelRep.setDisplayPosition(position);

        labelRep.setLabelText(
          `radius: ${(
            vec3.distance(
              [worldBounds[0], worldBounds[2], worldBounds[4]],
              [worldBounds[1], worldBounds[3], worldBounds[5]]
            ) / 2
          ).toFixed(2)}`
        );

        labelRep.setTextAlign(TextAlign.CENTER);
        labelRep.setVerticalAlign(VerticalAlign.CENTER);
      }
    );

    scene.rectangleHandle.setLabelTextCallback(
      (worldBounds, screenBounds, labelRep) => {
        const dx = Math.abs(worldBounds[0] - worldBounds[1]);
        const dy = Math.abs(worldBounds[2] - worldBounds[3]);
        const dz = Math.abs(worldBounds[4] - worldBounds[5]);

        const perimeter = 2 * (dx + dy + dz);
        const area = dx * dy + dy * dz + dz * dx;

        const text = `perimeter: ${perimeter.toFixed(
          1
        )}mm\narea: ${area.toFixed(1)}mm²`;

        const { width, height } = labelRep.computeTextDimensions(text);
        labelRep.setDisplayPosition(
          computeTextPosition(
            screenBounds,
            HorizontalTextPosition.OUTSIDE_RIGHT,
            VerticalTextPosition.INSIDE_TOP,
            width,
            height
          )
        );

        labelRep.setTextAlign(TextAlign.RIGHT);
      }
    );

    const updateWidgetVisibility = (widget, slicePos, i, widgetIndex) => {
      /* testing if the widget is on the slice and has been placed to modify visibility */
      const widgetVisibility =
        widget.getWidgetState().getPoint1Handle().getOrigin()[i] ===
          slicePos[i] ||
        !scene.widgetManager.getWidgets()[widgetIndex].getPoint1();
      return widget.setVisibility(widgetVisibility);
    };

    const updateWidgetsVisibility = (position, slicingMode) => {
      updateWidgetVisibility(widgets.rectangleWidget, position, slicingMode, 0);
      updateWidgetVisibility(widgets.ellipseWidget, position, slicingMode, 1);
      updateWidgetVisibility(widgets.circleWidget, position, slicingMode, 2);
    };

    const update = () => {
      const slicingMode = image.imageMapper.getSlicingMode() % 3;

      if (slicingMode > -1) {
        const ijk = [0, 0, 0];
        const position = [0, 0, 0];

        // position
        ijk[slicingMode] = image.imageMapper.getSlice();
        data.indexToWorld(ijk, position);

        widgets.rectangleWidget.getManipulator().setOrigin(position);
        widgets.ellipseWidget.getManipulator().setOrigin(position);
        widgets.circleWidget.getManipulator().setOrigin(position);

        updateWidgetsVisibility(position, slicingMode);

        scene.rectangleHandle.updateRepresentationForRender();
        scene.ellipseHandle.updateRepresentationForRender();
        scene.circleHandle.updateRepresentationForRender();

        // update UI
        document
          .querySelector('.slice')
          .setAttribute('max', data.getDimensions()[slicingMode] - 1);
      }
    };
    image.imageMapper.onModified(update);
    // trigger initial update
    update();

    readyAll();
  });

// register readyAll to resize event
window.addEventListener('resize', readyAll);
readyAll();

// ----------------------------------------------------------------------------
// UI logic
// ----------------------------------------------------------------------------

function resetWidgets() {
  scene.rectangleHandle.reset();
  scene.ellipseHandle.reset();
  scene.circleHandle.reset();
  widgets[activeWidget].setVisibility(true);
  scene.widgetManager.grabFocus(widgets[activeWidget]);
}

document.querySelector('.slice').addEventListener('input', (ev) => {
  image.imageMapper.setSlice(Number(ev.target.value));
});

document.querySelector('.axis').addEventListener('input', (ev) => {
  const sliceMode = 'IJKXYZ'.indexOf(ev.target.value) % 3;
  image.imageMapper.setSlicingMode(sliceMode);

  setCamera(sliceMode, scene.renderer, image.data);
  resetWidgets();
  scene.renderWindow.render();
});

document.querySelector('.widget').addEventListener('input', (ev) => {
  scene.widgetManager.grabFocus(widgets[ev.target.value]);
  activeWidget = ev.target.value;
});

document.querySelector('.reset').addEventListener('click', () => {
  resetWidgets();
  scene.renderWindow.render();
});

global.scene = scene;
global.widgets = widgets;
